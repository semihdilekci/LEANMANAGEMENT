/**
 * EventEmitter2 string olay adları + payload tipleri — PII yok
 */
export const PERMISSION_CACHE_EVENT = {
  /** UsersService: attribute / deactivate / anonymize — listener → invalidateUser */
  USER_INVALIDATE: 'user.permission_cache.invalidate',
  /** role_permissions değişimi ve role_rules (ABAC) değişimi — listener → invalidateRole */
  ROLE_AFFECTS_USER_PERMISSIONS: 'user.permission_cache.role_invalidate',
} as const;

export type UserPermissionCacheInvalidatePayload = {
  userId: string;
};

export type RoleAffectsUserPermissionsCachePayload = {
  roleId: string;
};
