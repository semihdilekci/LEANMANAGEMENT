/**
 * EventEmitter2 string olay adları + payload tipleri — PII yok
 */
export const PERMISSION_CACHE_EVENT = {
  /** UsersService: attribute / deactivate / anonymize — listener → invalidateUser */
  USER_INVALIDATE: 'user.permission_cache.invalidate',
} as const;

export type UserPermissionCacheInvalidatePayload = {
  userId: string;
};
