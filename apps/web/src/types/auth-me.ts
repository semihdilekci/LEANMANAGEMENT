/** GET /api/v1/auth/me yanıt gövdesi — KTİ / profil için backend ile eşlenik */
export interface AuthMeResponse {
  id: string;
  sicil: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarKey: string;
  phone: string | null;
  employeeType: string;
  company: { id: string; code: string; name: string };
  location: { id: string; code: string; name: string };
  department: { id: string; code: string; name: string };
  position: { id: string; code: string; name: string };
  level: { id: string; code: string; name: string };
  team: { id: string; code: string; name: string } | null;
  workArea: { id: string; code: string; name: string };
  workSubArea: { id: string; code: string; name: string } | null;
  manager: { id: string; sicil: string; firstName: string; lastName: string } | null;
  roles: Array<{
    id: string;
    code: string;
    name: string;
    source: 'DIRECT' | string;
  }>;
  permissions: string[];
  activeConsentVersionId: string | null;
  consentAccepted: boolean;
  passwordExpiresAt: string | null;
}
