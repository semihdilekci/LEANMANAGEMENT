import { Body, Controller, Get, HttpCode, Inject, Param, Put } from '@nestjs/common';
import {
  SystemSettingKeyParamSchema,
  SystemSettingPutBodySchema,
  type SystemSettingKey,
  type SystemSettingPutBody,
} from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import { Audit } from '../common/decorators/audit.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequireAnyPermission } from '../common/decorators/require-any-permission.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { SystemSettingsService } from './system-settings.service.js';

@Controller('admin/system-settings')
export class SystemSettingsController {
  constructor(
    @Inject(SystemSettingsService) private readonly systemSettings: SystemSettingsService,
  ) {}

  @Get()
  @HttpCode(200)
  /** Web menü + sayfa `VIEW | EDIT`; liste okuması düzenleme yetkisi olanlar için de gerekli */
  @RequireAnyPermission(Permission.SYSTEM_SETTINGS_VIEW, Permission.SYSTEM_SETTINGS_EDIT)
  async list(): Promise<Awaited<ReturnType<SystemSettingsService['list']>>> {
    return this.systemSettings.list();
  }

  @Put(':key')
  @HttpCode(200)
  @RequirePermission(Permission.SYSTEM_SETTINGS_EDIT)
  @Audit('UPDATE_SYSTEM_SETTING', 'system_setting')
  async put(
    @Param('key', createZodValidationPipe(SystemSettingKeyParamSchema)) key: SystemSettingKey,
    @Body(createZodValidationPipe(SystemSettingPutBodySchema)) body: SystemSettingPutBody,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<SystemSettingsService['updateByKey']>>> {
    return this.systemSettings.updateByKey(key, body.value, actor);
  }
}
