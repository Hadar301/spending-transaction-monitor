/**
 * Authentication Context
 * Provides auth functionality with development bypass support
 */
/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  AuthProvider as OIDCProvider,
  useAuth as useOIDCAuth,
} from 'react-oidc-context';
import type { User as OidcUser } from 'oidc-client-ts';
import { authConfig } from '../config/auth';
import type { User, AuthContextType } from '../schemas/auth';
import { DEV_USER } from '../constants/auth';
import { ApiClient } from '../services/apiClient';
import { clearStoredLocation } from '../hooks/useLocation';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Development Auth Provider - bypasses OIDC
 */
const DevAuthProvider = React.memo(({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const login = useCallback(() => {
    // No-op in dev mode since user is always authenticated
  }, []);

  const logout = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('🔓 Dev mode: logout() called - staying authenticated');
    }
    clearStoredLocation(); // Clear location data on logout (frontend cleanup)
    // Note: Location clearing also handled by backend on logout
    // No-op in dev mode since user stays authenticated
  }, []);

  const signinRedirect = useCallback(() => {
    // No-op in dev mode since user is already authenticated
  }, []);

  // Fetch user from backend on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Create apiClient instance for this request
        const client = new ApiClient();
        const response = await client.fetch('/api/users/profile');
        if (response.ok) {
          const apiUser = await response.json();
          const devUser: User = {
            id: apiUser.id,
            email: apiUser.email,
            username: apiUser.email.split('@')[0],
            name: `${apiUser.first_name} ${apiUser.last_name}`,
            roles: ['user', 'admin'], // Dev mode gets all roles
            isDevMode: true,
          };
          setUser(devUser);

          if (import.meta.env.DEV) {
            console.log('🔓 Dev mode: Loaded user from API:', {
              id: devUser.id,
              email: devUser.email,
            });
          }
        } else {
          // Fallback to hardcoded DEV_USER if API fails
          console.warn('Failed to fetch user from API, using fallback DEV_USER');
          setUser(DEV_USER);
        }
      } catch (err) {
        console.error('Error fetching dev user:', err);
        setError(new Error('Failed to load user'));
        // Fallback to hardcoded DEV_USER
        setUser(DEV_USER);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const contextValue: AuthContextType = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      signinRedirect,
      error,
    }),
    [user, isLoading, login, logout, signinRedirect, error],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
});
DevAuthProvider.displayName = 'DevAuthProvider';

/**
 * Production OIDC Auth Provider
 */
const ProductionAuthProvider = React.memo(
  ({ children }: { children: React.ReactNode }) => {
    const oidcConfig = useMemo(
      () => ({
        authority: authConfig.keycloak.authority,
        client_id: authConfig.keycloak.clientId,
        redirect_uri: authConfig.keycloak.redirectUri,
        post_logout_redirect_uri: authConfig.keycloak.postLogoutRedirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        // Renew access tokens in the background before they expire (required or API gets 401s).
        automaticSilentRenew: true,
        includeIdTokenInSilentRenew: true,
        storeUser: true,
        userStore: undefined, // default WebStorageStateStore (localStorage)
        loadUserInfo: false,
        monitorSession: false,
      }),
      [],
    );

    // Strip ?code=&state= (or hash equivalents) after redirect login. If they stay in the URL,
    // a full page refresh runs signinCallback again with a consumed code → auth error.
    const onSigninCallback = useCallback((_user: OidcUser | undefined) => {
      window.history.replaceState({}, document.title, window.location.pathname);
    }, []);

    return (
      <OIDCProvider {...oidcConfig} onSigninCallback={onSigninCallback}>
        <OIDCAuthWrapper>{children}</OIDCAuthWrapper>
      </OIDCProvider>
    );
  },
);
ProductionAuthProvider.displayName = 'ProductionAuthProvider';

/**
 * Wrapper for OIDC provider to adapt to our auth context
 */
const OIDCAuthWrapper = React.memo(({ children }: { children: React.ReactNode }) => {
  const oidcAuth = useOIDCAuth();
  const [user, setUser] = useState<User | null>(null);

  // Sync user + bearer token to ApiClient; register silent refresh for 401 recovery after idle.
  useEffect(() => {
    if (oidcAuth.error) {
      console.error('OIDC Authentication Error:', oidcAuth.error);
    }

    if (oidcAuth.user) {
      const newUser: User = {
        id: oidcAuth.user.profile.sub!,
        email: oidcAuth.user.profile.email!,
        username: oidcAuth.user.profile.preferred_username,
        name: oidcAuth.user.profile.name,
        roles: (oidcAuth.user.profile as { realm_access?: { roles?: string[] } })
          .realm_access?.roles || ['user'],
        isDevMode: false,
      };
      setUser(newUser);

      if (oidcAuth.user.access_token) {
        ApiClient.setToken(oidcAuth.user.access_token);
      }

      ApiClient.setAccessTokenRefresher(async () => {
        try {
          const refreshed = await oidcAuth.signinSilent();
          return refreshed?.access_token ?? null;
        } catch (e) {
          if (import.meta.env.DEV) {
            console.warn('Access token refresh (signinSilent) failed:', e);
          }
          return null;
        }
      });

      if (import.meta.env.DEV) {
        console.log('🔒 User authenticated via OIDC:', {
          id: oidcAuth.user.profile.sub,
          email: oidcAuth.user.profile.email,
        });
      }
    } else {
      setUser(null);
      clearStoredLocation();
      ApiClient.setToken(null);
      ApiClient.setAccessTokenRefresher(null);
    }
  }, [oidcAuth.user, oidcAuth.user?.access_token, oidcAuth.user?.expires_at, oidcAuth.error, oidcAuth.signinSilent]);

  // Location is now handled by LocationCapture component

  const login = useCallback(() => oidcAuth.signinRedirect(), [oidcAuth]);
  const logout = useCallback(() => oidcAuth.signoutRedirect(), [oidcAuth]);
  const signinRedirect = useCallback(() => oidcAuth.signinRedirect(), [oidcAuth]);

  const contextValue: AuthContextType = useMemo(() => {
    const authState = {
      user,
      isAuthenticated: !!oidcAuth.user,
      isLoading: oidcAuth.isLoading,
      login,
      logout,
      signinRedirect,
      error: oidcAuth.error ? new Error(oidcAuth.error.message) : null,
    };

    // Auth context state updated

    return authState;
  }, [
    user,
    oidcAuth.user,
    oidcAuth.isLoading,
    oidcAuth.error,
    login,
    logout,
    signinRedirect,
  ]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
});
OIDCAuthWrapper.displayName = 'OIDCAuthWrapper';

/**
 * Main Auth Provider - chooses development or production mode
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (authConfig.bypassAuth) {
    return <DevAuthProvider>{children}</DevAuthProvider>;
  }

  return <ProductionAuthProvider>{children}</ProductionAuthProvider>;
}
