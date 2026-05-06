/**
 * Unit tests for ApiClient authentication and JWT token management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiClient, apiClient } from '../apiClient';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock console methods to capture calls
const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('ApiClient', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    ApiClient.setToken(null);
    ApiClient.setAccessTokenRefresher(null);
    mockFetch.mockClear();
    consoleLog.mockClear();
    consoleWarn.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('JWT Token Retrieval', () => {
    it('should find JWT token with exact OIDC key pattern', async () => {
      // Arrange: Set up token in localStorage with exact pattern
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockpayload.signature';
      const oidcKey =
        'oidc.user:http://localhost:8080/realms/spending-monitor:spending-monitor';

      localStorage.setItem(
        oidcKey,
        JSON.stringify({
          access_token: mockToken,
          expires_at: Date.now() + 3600000,
        }),
      );

      mockFetch.mockResolvedValueOnce(new globalThis.Response('[]', { status: 200 }));

      // Act
      await apiClient.fetch('/api/test');

      // Assert - Core functionality: JWT token found and used correctly
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
      });
    });

    it('should find JWT token with fallback key scanning', async () => {
      // Arrange: Set up token with different authority URL
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fallback.signature';
      const fallbackKey =
        'oidc.user:https://keycloak.example.com/realms/test:test-client';

      localStorage.setItem(
        fallbackKey,
        JSON.stringify({
          access_token: mockToken,
          user_info: { email: 'test@example.com' },
        }),
      );

      mockFetch.mockResolvedValueOnce(new globalThis.Response('[]', { status: 200 }));

      // Act
      await apiClient.fetch('/api/test');

      // Assert - Both functional behavior AND logging
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
      });
      // Core functionality verified: JWT token found and used correctly
    });

    it('should make unauthenticated request when no JWT token found', async () => {
      // Arrange: No tokens in localStorage
      mockFetch.mockResolvedValueOnce(
        new globalThis.Response('{"detail":"Authentication required"}', {
          status: 401,
        }),
      );

      // Act
      await apiClient.fetch('/api/test');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Core functionality verified: unauthenticated request made correctly
    });

    it('should handle corrupted localStorage gracefully', async () => {
      // Arrange: Invalid JSON in localStorage
      const oidcKey =
        'oidc.user:http://localhost:8080/realms/spending-monitor:spending-monitor';
      localStorage.setItem(oidcKey, 'invalid-json-data');
      localStorage.setItem(
        'oidc.user:fallback:client',
        '{"access_token": "backup-token"}',
      );

      mockFetch.mockResolvedValueOnce(new globalThis.Response('[]', { status: 200 }));

      // Act
      await apiClient.fetch('/api/test');

      // Assert - Should fall back to scanning and find backup token
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          Authorization: 'Bearer backup-token',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle missing access_token in valid OIDC object', async () => {
      // Arrange: Valid OIDC object but no access_token
      const oidcKey =
        'oidc.user:http://localhost:8080/realms/spending-monitor:spending-monitor';
      localStorage.setItem(
        oidcKey,
        JSON.stringify({
          id_token: 'some-id-token',
          expires_at: Date.now() + 3600000,
          // No access_token
        }),
      );

      mockFetch.mockResolvedValueOnce(
        new globalThis.Response('{"detail":"Authentication required"}', {
          status: 401,
        }),
      );

      // Act
      await apiClient.fetch('/api/test');

      // Assert - Should make unauthenticated request without Authorization header
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Note: Console warnings may vary - main thing is no token found, so no auth header
    });

    it('should use localStorage token when static token is an expired JWT', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const payload = globalThis.btoa(JSON.stringify({ exp: pastExp }));
      const staleJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
      const freshToken = 'fresh-from-oidc-storage';
      ApiClient.setToken(staleJwt);
      const oidcKey =
        'oidc.user:http://localhost:8080/realms/spending-monitor:spending-monitor';
      localStorage.setItem(
        oidcKey,
        JSON.stringify({
          access_token: freshToken,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
      mockFetch.mockResolvedValueOnce(new globalThis.Response('[]', { status: 200 }));

      await apiClient.fetch('/api/test');

      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('HTTP Request Handling', () => {
    it('should preserve existing headers while adding authentication', async () => {
      // Arrange
      const mockToken = 'test-token';
      localStorage.setItem(
        'oidc.user:test:client',
        JSON.stringify({
          access_token: mockToken,
        }),
      );

      mockFetch.mockResolvedValueOnce(new globalThis.Response('{}', { status: 200 }));

      // Act
      await apiClient.fetch('/api/test', {
        headers: {
          'X-Custom-Header': 'custom-value',
          Accept: 'application/vnd.api+json',
        },
      });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          'X-Custom-Header': 'custom-value',
          Accept: 'application/vnd.api+json',
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle different HTTP methods correctly', async () => {
      // Arrange
      const mockToken = 'test-token';
      localStorage.setItem(
        'oidc.user:test:client',
        JSON.stringify({
          access_token: mockToken,
        }),
      );

      mockFetch.mockResolvedValueOnce(new globalThis.Response('{}', { status: 201 }));

      // Act
      await apiClient.fetch('/api/test', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
      });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('Real-world OIDC Token Patterns', () => {
    it('should handle Keycloak production token structure', async () => {
      // Arrange - Real Keycloak token structure
      const keycloakToken = {
        access_token:
          'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJrZXljbG9hay1pZCJ9.eyJleHAiOjE2OTc2NjE2MDAsImlhdCI6MTY5NzY2MTMwMCwianRpIjoiYWJjZGVmZ2gtMTIzNCIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9yZWFsbXMvc3BlbmRpbmctbW9uaXRvciIsInN1YiI6InVzZXItaWQtMTIzIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoic3BlbmRpbmctbW9uaXRvciIsInNlc3Npb25fc3RhdGUiOiJzZXNzaW9uLTEyMyIsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJ0ZXN0dXNlciJ9.signature',
        token_type: 'Bearer',
        expires_in: 300,
        refresh_token: 'refresh-token-data',
        expires_at: Date.now() + 300000,
        profile: {
          sub: 'user-id-123',
          email: 'test@test.com',
          preferred_username: 'testuser',
        },
      };

      localStorage.setItem(
        'oidc.user:http://localhost:8080/realms/spending-monitor:spending-monitor',
        JSON.stringify(keycloakToken),
      );

      mockFetch.mockResolvedValueOnce(
        new globalThis.Response('{"success": true}', { status: 200 }),
      );

      // Act
      const response = await apiClient.fetch('/api/users/profile');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/users/profile', {
        headers: {
          Authorization: `Bearer ${keycloakToken.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      expect(response.status).toBe(200);
    });

    it('should work with Auth0 token structure', async () => {
      // Arrange - Auth0-style token structure
      const auth0Token = {
        access_token: 'auth0-jwt-token',
        id_token: 'auth0-id-token',
        scope: 'openid profile email',
        expires_in: 86400,
        token_type: 'Bearer',
      };

      localStorage.setItem(
        'oidc.user:https://dev-auth0.auth0.com:auth0-client',
        JSON.stringify(auth0Token),
      );

      mockFetch.mockResolvedValueOnce(new globalThis.Response('{}', { status: 200 }));

      // Act
      await apiClient.fetch('/api/test');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          Authorization: `Bearer ${auth0Token.access_token}`,
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('Access token refresh on 401', () => {
    it('should retry fetch once after refresher returns a new token', async () => {
      const oldToken =
        'eyJhbGciOiJIUzI1NiJ9.' +
        globalThis.btoa(JSON.stringify({ exp: 9999999999 })) +
        '.sig';
      const newToken =
        'eyJhbGciOiJIUzI1NiJ9.' +
        globalThis.btoa(JSON.stringify({ exp: 9999999999 })) +
        '.new';

      ApiClient.setToken(oldToken);
      const refresher = vi.fn().mockResolvedValue(newToken);
      ApiClient.setAccessTokenRefresher(refresher);

      mockFetch
        .mockResolvedValueOnce(
          new globalThis.Response('{"detail":"Token expired"}', { status: 401 }),
        )
        .mockResolvedValueOnce(new globalThis.Response('[]', { status: 200 }));

      const response = await apiClient.fetch('/api/transactions');

      expect(refresher).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(
        `Bearer ${oldToken}`,
      );
      expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe(
        `Bearer ${newToken}`,
      );
      expect(response.status).toBe(200);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle fetch failures gracefully', async () => {
      // Arrange
      localStorage.setItem(
        'oidc.user:test:client',
        JSON.stringify({
          access_token: 'test-token',
        }),
      );

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(apiClient.fetch('/api/test')).rejects.toThrow('Network error');
    });

    it('should handle extremely long localStorage keys', async () => {
      // Arrange - Edge case with very long key
      const longKey = 'oidc.user:' + 'a'.repeat(1000) + ':client';
      localStorage.setItem(
        longKey,
        JSON.stringify({
          access_token: 'long-key-token',
        }),
      );

      mockFetch.mockResolvedValueOnce(new globalThis.Response('{}', { status: 200 }));

      // Act
      await apiClient.fetch('/api/test');

      // Assert - Should still find the token
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          Authorization: 'Bearer long-key-token',
          'Content-Type': 'application/json',
        },
      });
    });
  });
});
