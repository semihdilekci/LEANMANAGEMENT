import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@leanmgmt/shared-types';

export const ANY_PERMISSIONS_KEY = 'any_permissions';

/** En az biri yeter; `PermissionGuard` ile */
export const RequireAnyPermission = (
  ...permissions: Permission[]
): ReturnType<typeof SetMetadata> => SetMetadata(ANY_PERMISSIONS_KEY, permissions);
