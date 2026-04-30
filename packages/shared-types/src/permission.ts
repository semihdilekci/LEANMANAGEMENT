/**
 * Seed ile hizalı permission_key değerleri — apps/api/prisma/seed.ts ALL_PERMISSION_KEYS
 * Faz 4 RBAC metadata buradan türetilir.
 */
export enum Permission {
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE_ATTRIBUTE = 'USER_UPDATE_ATTRIBUTE',
  USER_LIST_VIEW = 'USER_LIST_VIEW',
  USER_DEACTIVATE = 'USER_DEACTIVATE',
  USER_REACTIVATE = 'USER_REACTIVATE',
  USER_ROLE_ASSIGN = 'USER_ROLE_ASSIGN',
  ROLE_CREATE = 'ROLE_CREATE',
  ROLE_VIEW = 'ROLE_VIEW',
  ROLE_UPDATE = 'ROLE_UPDATE',
  ROLE_DELETE = 'ROLE_DELETE',
  ROLE_PERMISSION_MANAGE = 'ROLE_PERMISSION_MANAGE',
  ROLE_ASSIGN = 'ROLE_ASSIGN',
  ROLE_RULE_MANAGE = 'ROLE_RULE_MANAGE',
  PROCESS_KTI_START = 'PROCESS_KTI_START',
  PROCESS_CANCEL = 'PROCESS_CANCEL',
  PROCESS_ROLLBACK = 'PROCESS_ROLLBACK',
  PROCESS_VIEW_ALL = 'PROCESS_VIEW_ALL',
  MASTER_DATA_MANAGE = 'MASTER_DATA_MANAGE',
  AUDIT_LOG_VIEW = 'AUDIT_LOG_VIEW',
  SYSTEM_SETTINGS_VIEW = 'SYSTEM_SETTINGS_VIEW',
  SYSTEM_SETTINGS_EDIT = 'SYSTEM_SETTINGS_EDIT',
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  USER_SESSION_VIEW = 'USER_SESSION_VIEW',
  USER_SESSION_REVOKE = 'USER_SESSION_REVOKE',
  USER_ANONYMIZE = 'USER_ANONYMIZE',
  NOTIFICATION_READ = 'NOTIFICATION_READ',
  EMAIL_TEMPLATE_VIEW = 'EMAIL_TEMPLATE_VIEW',
  EMAIL_TEMPLATE_EDIT = 'EMAIL_TEMPLATE_EDIT',
  CONSENT_VERSION_VIEW = 'CONSENT_VERSION_VIEW',
  CONSENT_VERSION_EDIT = 'CONSENT_VERSION_EDIT',
  CONSENT_VERSION_PUBLISH = 'CONSENT_VERSION_PUBLISH',
  USER_PROFILE_VIEW = 'USER_PROFILE_VIEW',
  MASTER_DATA_VIEW = 'MASTER_DATA_VIEW',
}

export type PermissionCategory = 'MENU' | 'ACTION' | 'DATA' | 'FIELD';

export interface PermissionMetadata {
  key: Permission;
  category: PermissionCategory;
  description: string;
  isSensitive: boolean;
}

export const PERMISSION_METADATA: Record<Permission, PermissionMetadata> = {
  [Permission.USER_CREATE]: {
    key: Permission.USER_CREATE,
    category: 'ACTION',
    description: 'Yeni kullanıcı oluşturma',
    isSensitive: true,
  },
  [Permission.USER_UPDATE_ATTRIBUTE]: {
    key: Permission.USER_UPDATE_ATTRIBUTE,
    category: 'ACTION',
    description: 'Kullanıcı organizasyonel alanlarını güncelleme',
    isSensitive: true,
  },
  [Permission.USER_LIST_VIEW]: {
    key: Permission.USER_LIST_VIEW,
    category: 'DATA',
    description: 'Kullanıcı listesi ve detay görüntüleme',
    isSensitive: false,
  },
  [Permission.USER_DEACTIVATE]: {
    key: Permission.USER_DEACTIVATE,
    category: 'ACTION',
    description: 'Kullanıcı pasifleştirme',
    isSensitive: true,
  },
  [Permission.USER_REACTIVATE]: {
    key: Permission.USER_REACTIVATE,
    category: 'ACTION',
    description: 'Pasif kullanıcıyı yeniden aktifleştirme',
    isSensitive: true,
  },
  [Permission.USER_ROLE_ASSIGN]: {
    key: Permission.USER_ROLE_ASSIGN,
    category: 'ACTION',
    description: 'Kullanıcıya doğrudan rol atama / kaldırma',
    isSensitive: true,
  },
  [Permission.ROLE_CREATE]: {
    key: Permission.ROLE_CREATE,
    category: 'ACTION',
    description: 'Yeni rol oluşturma',
    isSensitive: true,
  },
  [Permission.ROLE_VIEW]: {
    key: Permission.ROLE_VIEW,
    category: 'DATA',
    description: 'Rol tanımlarını görüntüleme',
    isSensitive: false,
  },
  [Permission.ROLE_UPDATE]: {
    key: Permission.ROLE_UPDATE,
    category: 'ACTION',
    description: 'Rol adı ve açıklama güncelleme',
    isSensitive: true,
  },
  [Permission.ROLE_DELETE]: {
    key: Permission.ROLE_DELETE,
    category: 'ACTION',
    description: 'Rol silme (sistem rolleri hariç)',
    isSensitive: true,
  },
  [Permission.ROLE_PERMISSION_MANAGE]: {
    key: Permission.ROLE_PERMISSION_MANAGE,
    category: 'ACTION',
    description: 'Rol yetki matrisi düzenleme',
    isSensitive: true,
  },
  [Permission.ROLE_ASSIGN]: {
    key: Permission.ROLE_ASSIGN,
    category: 'ACTION',
    description: 'Rol atama işlemleri (admin akışı)',
    isSensitive: true,
  },
  [Permission.ROLE_RULE_MANAGE]: {
    key: Permission.ROLE_RULE_MANAGE,
    category: 'ACTION',
    description: 'Attribute tabanlı rol kuralları yönetimi',
    isSensitive: true,
  },
  [Permission.PROCESS_KTI_START]: {
    key: Permission.PROCESS_KTI_START,
    category: 'ACTION',
    description: 'KTİ süreci başlatma',
    isSensitive: false,
  },
  [Permission.PROCESS_CANCEL]: {
    key: Permission.PROCESS_CANCEL,
    category: 'ACTION',
    description: 'Süreç iptali',
    isSensitive: true,
  },
  [Permission.PROCESS_ROLLBACK]: {
    key: Permission.PROCESS_ROLLBACK,
    category: 'ACTION',
    description: 'Süreç geri alma',
    isSensitive: true,
  },
  [Permission.PROCESS_VIEW_ALL]: {
    key: Permission.PROCESS_VIEW_ALL,
    category: 'DATA',
    description: 'Tüm süreçleri görüntüleme (sahiplik dışı)',
    isSensitive: true,
  },
  [Permission.MASTER_DATA_MANAGE]: {
    key: Permission.MASTER_DATA_MANAGE,
    category: 'ACTION',
    description: 'Master data oluşturma ve güncelleme',
    isSensitive: true,
  },
  [Permission.AUDIT_LOG_VIEW]: {
    key: Permission.AUDIT_LOG_VIEW,
    category: 'MENU',
    description: 'Denetim kayıtlarını görüntüleme',
    isSensitive: true,
  },
  [Permission.SYSTEM_SETTINGS_VIEW]: {
    key: Permission.SYSTEM_SETTINGS_VIEW,
    category: 'DATA',
    description: 'Sistem ayarlarını listeleme (salt okunur)',
    isSensitive: true,
  },
  [Permission.SYSTEM_SETTINGS_EDIT]: {
    key: Permission.SYSTEM_SETTINGS_EDIT,
    category: 'ACTION',
    description: 'Sistem ayarlarını düzenleme',
    isSensitive: true,
  },
  [Permission.DOCUMENT_UPLOAD]: {
    key: Permission.DOCUMENT_UPLOAD,
    category: 'ACTION',
    description: 'Süreç bağlamında doküman yükleme',
    isSensitive: false,
  },
  [Permission.USER_SESSION_VIEW]: {
    key: Permission.USER_SESSION_VIEW,
    category: 'DATA',
    description: 'Kullanıcı oturumlarını listeleme',
    isSensitive: true,
  },
  [Permission.USER_SESSION_REVOKE]: {
    key: Permission.USER_SESSION_REVOKE,
    category: 'ACTION',
    description: 'Kullanıcı oturumunu sonlandırma',
    isSensitive: true,
  },
  [Permission.USER_ANONYMIZE]: {
    key: Permission.USER_ANONYMIZE,
    category: 'ACTION',
    description: 'KVKK kapsamında kullanıcı anonimleştirme',
    isSensitive: true,
  },
  [Permission.NOTIFICATION_READ]: {
    key: Permission.NOTIFICATION_READ,
    category: 'MENU',
    description: 'Bildirim merkezi, okunmamış sayacı ve bildirim tercihleri',
    isSensitive: false,
  },
  [Permission.EMAIL_TEMPLATE_VIEW]: {
    key: Permission.EMAIL_TEMPLATE_VIEW,
    category: 'DATA',
    description: 'E-posta şablonlarını görüntüleme',
    isSensitive: false,
  },
  [Permission.EMAIL_TEMPLATE_EDIT]: {
    key: Permission.EMAIL_TEMPLATE_EDIT,
    category: 'ACTION',
    description: 'E-posta şablonlarını düzenleme ve önizleme',
    isSensitive: true,
  },
  [Permission.CONSENT_VERSION_VIEW]: {
    key: Permission.CONSENT_VERSION_VIEW,
    category: 'DATA',
    description: 'KVKK rıza metni versiyonlarını listeleme',
    isSensitive: true,
  },
  [Permission.CONSENT_VERSION_EDIT]: {
    key: Permission.CONSENT_VERSION_EDIT,
    category: 'ACTION',
    description: 'Rıza metni taslağı oluşturma ve güncelleme',
    isSensitive: true,
  },
  [Permission.CONSENT_VERSION_PUBLISH]: {
    key: Permission.CONSENT_VERSION_PUBLISH,
    category: 'ACTION',
    description: 'Rıza metni versiyonunu yayınlama',
    isSensitive: true,
  },
  [Permission.USER_PROFILE_VIEW]: {
    key: Permission.USER_PROFILE_VIEW,
    category: 'DATA',
    description: 'Kendi veya yetkili profil görüntüleme',
    isSensitive: false,
  },
  [Permission.MASTER_DATA_VIEW]: {
    key: Permission.MASTER_DATA_VIEW,
    category: 'DATA',
    description: 'Master data salt okunur listeleme',
    isSensitive: false,
  },
};
