'use client';

import type { Permission } from '@leanmgmt/shared-types';

import { useHasAnyPermission, useHasPermission } from '@/hooks/usePermissions';

interface PermissionGateProps {
  permission?: Permission;
  anyOf?: Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * UX gizleme bileşeni — güvenlik değil.
 * Backend'de @RequirePermission zaten enforce ediyor.
 */
export function PermissionGate({
  permission,
  anyOf,
  fallback = null,
  children,
}: PermissionGateProps) {
  const hasSingle = useHasPermission(permission ?? ('' as Permission));
  const hasAny = useHasAnyPermission(anyOf ?? []);

  const allowed = permission ? hasSingle : anyOf ? hasAny : true;

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
