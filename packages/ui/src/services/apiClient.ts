/**
 * Centralized API client with authentication and location header support
 * Automatically includes user location in API requests for fraud detection
 */

import { getStoredLocation } from '../hooks/useLocation';
import { createLocationHeaders, type Location } from '../schemas/location';
import type { ApiClientConfig, ApiResponse } from '../schemas/api';

/** If JWT exp is within leeway of "now", treat as expired so we read a fresher token from OIDC storage. */
function isJwtAccessTokenLikelyExpired(token: string, leewaySeconds: number): boolean {
  const parts = token.split('.');
  if (parts.length < 2) return false;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof payload.exp !== 'number') return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now + leewaySeconds;
  } catch {
    return false;
  }
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private includeLocation: boolean;
  private defaultHeaders: Record<string, string>;

  // Static method to set token from auth context
  private static currentToken: string | null = null;
  private static onAuthError?: () => void;
  /** OIDC silent refresh (`signinSilent`) — returns new access_token or null. */
  private static accessTokenRefresher: (() => Promise<string | null>) | null = null;

  static setToken(token: string | null) {
    ApiClient.currentToken = token;
  }

  static setAuthErrorHandler(handler: () => void) {
    ApiClient.onAuthError = handler;
  }

  static setAccessTokenRefresher(refresher: (() => Promise<string | null>) | null) {
    ApiClient.accessTokenRefresher = refresher;
  }

  private static async tryRefreshAccessToken(): Promise<string | null> {
    if (!ApiClient.accessTokenRefresher) return null;
    try {
      return (await ApiClient.accessTokenRefresher()) ?? null;
    } catch {
      return null;
    }
  }

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl =
      config.baseUrl ||
      (typeof window !== 'undefined' && window.ENV?.API_BASE_URL) ||
      '/api';
    this.timeout = config.timeout || 30000;
    this.includeLocation = config.includeLocation ?? true;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  private getToken(): string | null {
    // Prefer in-memory token only while it is still valid; after expiry OIDC may have
    // renewed in localStorage before React re-ran ApiClient.setToken().
    const cached = ApiClient.currentToken;
    if (cached && !isJwtAccessTokenLikelyExpired(cached, 120)) {
      if (import.meta.env.DEV) {
        console.log('🔑 Using static token from auth context');
      }
      return cached;
    }

    // Check localStorage for OIDC tokens
    const allKeys = Object.keys(localStorage);
    const oidcKeys = allKeys.filter((k) => k.includes('oidc'));

    if (import.meta.env.DEV) {
      console.log('🔍 Looking for OIDC tokens in localStorage:', {
        allKeys: allKeys.length,
        oidcKeys: oidcKeys.length,
        oidcKeyList: oidcKeys,
      });
    }

    // Try multiple possible key patterns
    const possibleKeys = [
      'oidc.user:http://localhost:8080/realms/spending-monitor:spending-monitor',
    ];

    // First try specific keys
    for (const key of possibleKeys) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.access_token) {
            if (import.meta.env.DEV) {
              console.log('🔑 Found token in specific key:', key);
            }
            return parsed.access_token;
          }
        }
      } catch {
        // Continue looking
      }
    }

    // Fallback: check all OIDC keys
    for (const k of oidcKeys) {
      try {
        const stored = localStorage.getItem(k);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.access_token) {
            if (import.meta.env.DEV) {
              console.log('🔑 Found token in OIDC key:', k);
            }
            return parsed.access_token;
          }
        }
      } catch {
        // Continue looking
      }
    }

    if (import.meta.env.DEV) {
      console.warn('⚠️ No JWT token found in localStorage');
    }
    return null;
  }

  /**
   * Create request headers including location and authentication if available
   */
  private createHeaders(
    customHeaders?: Record<string, string>,
  ): Record<string, string> {
    const headers = { ...this.defaultHeaders, ...customHeaders };

    // Add authentication token
    const token = this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Add location headers if enabled
    if (this.includeLocation) {
      const location = getStoredLocation();
      if (location) {
        Object.assign(headers, createLocationHeaders(location));
      }
    }

    return headers;
  }

  /**
   * Make a request with timeout and error handling
   */
  private async makeRequest<T>(
    url: string,
    options: globalThis.RequestInit = {},
    customLocation?: Location | null,
  ): Promise<ApiResponse<T>> {
    for (let attempt = 0; attempt < 2; attempt++) {
      let didTimeout = false;
      const timeoutPromise: Promise<never> = new Promise((_, reject) => {
        setTimeout(() => {
          didTimeout = true;
          reject(new ApiError('Request timeout', 408));
        }, this.timeout);
      });

      try {
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

        let headers = this.createHeaders(options.headers as Record<string, string>);

        if (customLocation) {
          Object.assign(headers, createLocationHeaders(customLocation));
        } else if (customLocation === null) {
          delete headers['X-User-Latitude'];
          delete headers['X-User-Longitude'];
          delete headers['X-User-Location-Accuracy'];
        }

        const hadAuthorization = Boolean(headers.Authorization);

        const response = (await Promise.race([
          fetch(fullUrl, { ...options, headers }),
          timeoutPromise,
        ])) as globalThis.Response;

        const contentType = response.headers?.get?.('content-type') ?? null;
        let data: T;

        if (contentType && contentType.includes('application/json')) {
          data = (await response.json()) as T;
        } else if (
          typeof (response as { text?: () => Promise<string> }).text === 'function'
        ) {
          data = (await response.text()) as unknown as T;
        } else {
          data = undefined as unknown as T;
        }

        if (!response.ok) {
          const apiError = new ApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            data,
          );

          if (
            response.status === 401 &&
            hadAuthorization &&
            attempt === 0 &&
            ApiClient.accessTokenRefresher
          ) {
            const newToken = await ApiClient.tryRefreshAccessToken();
            if (newToken) {
              ApiClient.setToken(newToken);
              continue;
            }
          }

          if (apiError.isAuthError && ApiClient.onAuthError) {
            console.warn(
              '🔒 Authentication error detected, triggering auth error handler',
            );
            ApiClient.onAuthError();
          }

          throw apiError;
        }

        return {
          data,
          status: response?.status ?? 200,
          statusText: response?.statusText ?? 'OK',
          headers: response?.headers ?? new globalThis.Headers(),
        };
      } catch (error) {
        if (didTimeout) {
          throw error;
        }
        throw error;
      }
    }
    throw new Error('ApiClient.makeRequest: internal error');
  }

  /**
   * Legacy fetch method for backward compatibility
   */
  async fetch(
    url: string,
    options: globalThis.RequestInit = {},
  ): Promise<globalThis.Response> {
    for (let attempt = 0; ; attempt++) {
      const headers = this.createHeaders(options.headers as Record<string, string>);
      const hadAuthorization = Boolean(headers.Authorization);
      const response = await fetch(url, { ...options, headers });

      if (
        response.status !== 401 ||
        !hadAuthorization ||
        !ApiClient.accessTokenRefresher ||
        attempt > 0
      ) {
        return response;
      }

      const newToken = await ApiClient.tryRefreshAccessToken();
      if (!newToken) {
        return response;
      }
      ApiClient.setToken(newToken);
    }
  }

  /**
   * GET request
   */
  async get<T>(
    url: string,
    options?: {
      headers?: Record<string, string>;
      location?: Location | null;
    },
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(
      url,
      {
        method: 'GET',
        headers: options?.headers,
      },
      options?.location,
    );
  }

  /**
   * POST request
   */
  async post<T>(
    url: string,
    data?: unknown,
    options?: {
      headers?: Record<string, string>;
      location?: Location | null;
    },
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(
      url,
      {
        method: 'POST',
        headers: options?.headers,
        body: data ? JSON.stringify(data) : undefined,
      },
      options?.location,
    );
  }

  /**
   * PUT request
   */
  async put<T>(
    url: string,
    data?: unknown,
    options?: {
      headers?: Record<string, string>;
      location?: Location | null;
    },
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(
      url,
      {
        method: 'PUT',
        headers: options?.headers,
        body: data ? JSON.stringify(data) : undefined,
      },
      options?.location,
    );
  }

  /**
   * DELETE request
   */
  async delete<T>(
    url: string,
    options?: {
      headers?: Record<string, string>;
      location?: Location | null;
    },
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(
      url,
      {
        method: 'DELETE',
        headers: options?.headers,
      },
      options?.location,
    );
  }

  /**
   * Update location inclusion setting
   */
  setIncludeLocation(include: boolean): void {
    this.includeLocation = include;
  }

  /**
   * Set default headers
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public status: number;
  public data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }

  /**
   * Check if error is due to authentication failure
   */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /**
   * Check if error is due to network/server issues
   */
  get isNetworkError(): boolean {
    return this.status >= 500 || this.status === 408;
  }
}

// Default API client instance
export const apiClient = new ApiClient();

// Convenience function to create a client with custom config
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

// Legacy fetch wrapper for backward compatibility
export async function fetchWithLocation(
  url: string,
  options: globalThis.RequestInit = {},
  customLocation?: Location | null,
): Promise<globalThis.Response> {
  const headers = new globalThis.Headers(options.headers);

  // Add location headers if not explicitly disabled
  if (customLocation !== null) {
    const location = customLocation || getStoredLocation();
    if (location) {
      const locationHeaders = createLocationHeaders(location);
      Object.entries(locationHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Hook for API client with location context
 */
export function useApiClient(location?: Location | null) {
  const client = new ApiClient({ includeLocation: location !== null });

  return {
    get: <T>(url: string, options?: { headers?: Record<string, string> }) =>
      client.get<T>(url, { ...options, location }),
    post: <T>(
      url: string,
      data?: unknown,
      options?: { headers?: Record<string, string> },
    ) => client.post<T>(url, data, { ...options, location }),
    put: <T>(
      url: string,
      data?: unknown,
      options?: { headers?: Record<string, string> },
    ) => client.put<T>(url, data, { ...options, location }),
    delete: <T>(url: string, options?: { headers?: Record<string, string> }) =>
      client.delete<T>(url, { ...options, location }),
  };
}
