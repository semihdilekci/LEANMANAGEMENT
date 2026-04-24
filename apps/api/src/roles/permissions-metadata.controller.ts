import { Controller, Get } from '@nestjs/common';
import { PERMISSION_METADATA, Permission } from '@leanmgmt/shared-types';

import { RequirePermission } from '../common/decorators/require-permission.decorator.js';

/**
 * docs/03_API_CONTRACTS.md — GET /permissions
 * Rol-yetki matrisi metadata; ROLE_VIEW ile sınırlı (admin rol ekranları).
 */
@Controller('permissions')
export class PermissionsMetadataController {
  @Get()
  @RequirePermission(Permission.ROLE_VIEW)
  list(): { key: string; category: string; description: string; isSensitive: boolean }[] {
    return Object.values(PERMISSION_METADATA).map((meta) => ({
      key: meta.key,
      category: meta.category,
      description: meta.description,
      isSensitive: meta.isSensitive,
    }));
  }
}
