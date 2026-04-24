import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { clearSessionHintCookie, readCookie, setSessionHintCookie } from '@/lib/auth-session-hint';
import { useAuthStore, type AuthUser } from '@/stores/auth-store';

export type { AuthUser };

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: {
      unlocksAt?: string;
      retryAfterSeconds?: number;
      reason?: string;
      fields?: Record<string, string>;
    } & Record<string, unknown>;
  };
}

function isEnvelopeError(data: unknown): data is ApiErrorBody {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    (data as { success: unknown }).success === false &&
    'error' in data &&
    typeof (data as { error: unknown }).error === 'object'
  );
}

const client = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<void> | null = null;

/** Çift çağrıda tek uçuş — interceptor ile paylaşılır */
export async function refreshAccessToken(): Promise<void> {
  const store = useAuthStore.getState();
  const csrf = store.csrfToken ?? readCookie('csrf_token');
  if (!csrf) {
    throw new Error('CSRF token missing');
  }
  const res = await axios.post<{
    success: boolean;
    data: { accessToken: string; accessTokenExpiresAt: string; csrfToken: string };
  }>(
    '/api/v1/auth/refresh',
    {},
    {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
    },
  );
  if (!res.data.success || !res.data.data) {
    throw new Error('Refresh failed');
  }
  const { accessToken, accessTokenExpiresAt, csrfToken } = res.data.data;
  useAuthStore.getState().setTokens({ accessToken, accessTokenExpiresAt, csrfToken });
  setSessionHintCookie();

  const meRes = await client.get<{ success: boolean; data: AuthUser }>('/api/v1/auth/me');
  if (meRes.data.success && meRes.data.data) {
    useAuthStore.setState({ currentUser: meRes.data.data as AuthUser });
  }
}

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken, csrfToken } = useAuthStore.getState();
  const method = (config.method ?? 'get').toLowerCase();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  const csrf = csrfToken ?? readCookie('csrf_token');
  if (csrf && ['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

client.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = err.response?.status;
    const data = err.response?.data;

    if (!original || original._retry) {
      return Promise.reject(err);
    }

    const code = isEnvelopeError(data) ? data.error.code : undefined;
    const shouldTryRefresh =
      status === 401 && (code === 'AUTH_TOKEN_EXPIRED' || code === 'AUTH_TOKEN_INVALID');

    if (shouldTryRefresh && !original.url?.includes('/auth/refresh')) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        await refreshPromise;
        return client(original);
      } catch {
        useAuthStore.getState().clearAuth();
        clearSessionHintCookie();
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  },
);

export const apiClient = client;

export async function loginRequest(email: string, password: string): Promise<void> {
  const res = await client.post<{
    success: boolean;
    data: {
      accessToken: string;
      accessTokenExpiresAt: string;
      csrfToken: string;
      user: AuthUser;
    };
  }>('/api/v1/auth/login', { email, password });
  if (!res.data.success || !res.data.data) {
    throw new Error('Login yanıtı geçersiz');
  }
  const { accessToken, accessTokenExpiresAt, csrfToken, user } = res.data.data;
  useAuthStore.getState().setAuth({
    accessToken,
    accessTokenExpiresAt,
    csrfToken,
    user,
  });
  setSessionHintCookie();
}

export async function logoutRequest(): Promise<void> {
  try {
    await client.post('/api/v1/auth/logout', {});
  } finally {
    useAuthStore.getState().clearAuth();
    clearSessionHintCookie();
  }
}
