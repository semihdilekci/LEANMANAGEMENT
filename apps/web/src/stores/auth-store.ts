import { create } from 'zustand';

/** GET /auth/me ve login yanıtı ile hizalı (şirket / yönetici KTİ başlatma için) */
export interface AuthUserCompany {
  id: string;
  code: string;
  name: string;
}

export interface AuthUserManager {
  id: string;
  sicil: string;
  firstName: string;
  lastName: string;
}

export interface AuthUser {
  id: string;
  sicil: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Weather preset key — eski oturumlarda yoksa `UserAvatar` varsayılan kullanır */
  avatarKey?: string;
  permissions: string[];
  activeConsentVersionId: string | null;
  consentAccepted: boolean;
  passwordExpiresAt: string | null;
  company?: AuthUserCompany;
  manager?: AuthUserManager | null;
}

interface AuthState {
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  csrfToken: string | null;
  currentUser: AuthUser | null;
  setAuth: (input: {
    accessToken: string;
    accessTokenExpiresAt: string;
    csrfToken: string;
    user: AuthUser;
  }) => void;
  setTokens: (input: {
    accessToken: string;
    accessTokenExpiresAt: string;
    csrfToken: string;
  }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  accessTokenExpiresAt: null,
  csrfToken: null,
  currentUser: null,
  setAuth: ({ accessToken, accessTokenExpiresAt, csrfToken, user }) =>
    set({ accessToken, accessTokenExpiresAt, csrfToken, currentUser: user }),
  setTokens: ({ accessToken, accessTokenExpiresAt, csrfToken }) =>
    set((s) => ({ ...s, accessToken, accessTokenExpiresAt, csrfToken })),
  clearAuth: () =>
    set({
      accessToken: null,
      accessTokenExpiresAt: null,
      csrfToken: null,
      currentUser: null,
    }),
}));
