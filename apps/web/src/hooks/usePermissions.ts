'use client';

import { useAuthStore } from '@/stores/auth-store';
import { Permission } from '@leanmgmt/shared-types';

export function usePermissions(): Set<Permission> {
  const currentUser = useAuthStore((s) => s.currentUser);
  if (!currentUser?.permissions) return new Set<Permission>();
  return new Set(currentUser.permissions as Permission[]);
}

export function useHasPermission(permission: Permission): boolean {
  const permissions = usePermissions();
  return permissions.has(permission);
}

export function useHasAnyPermission(perms: Permission[]): boolean {
  const permissions = usePermissions();
  return perms.some((p) => permissions.has(p));
}
