import { Controller, Get, HttpCode, Inject } from '@nestjs/common';
import { Permission } from '@leanmgmt/shared-types';

import { RequireAnyPermission } from '../common/decorators/require-any-permission.decorator.js';

import { AdminSummaryService } from './admin-summary.service.js';

/**
 * Admin layout `ADMIN_ENTRY_ANY_OF` ile aynı kümle hizalı — özet ekranı her admin girişi için.
 */
@Controller('admin')
export class AdminSummaryController {
  constructor(@Inject(AdminSummaryService) private readonly adminSummary: AdminSummaryService) {}

  @Get('summary')
  @HttpCode(200)
  @RequireAnyPermission(
    Permission.AUDIT_LOG_VIEW,
    Permission.SYSTEM_SETTINGS_VIEW,
    Permission.SYSTEM_SETTINGS_EDIT,
    Permission.CONSENT_VERSION_VIEW,
    Permission.CONSENT_VERSION_EDIT,
    Permission.CONSENT_VERSION_PUBLISH,
    Permission.EMAIL_TEMPLATE_VIEW,
  )
  async getSummary() {
    return this.adminSummary.getOrganizationSummary();
  }
}
