import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@leanmgmt/shared-types';

export const PERMISSIONS_KEY = 'permissions';

/** PermissionGuard ile enforce edilir */
export const RequirePermission = (...permissions: Permission[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(PERMISSIONS_KEY, permissions);
