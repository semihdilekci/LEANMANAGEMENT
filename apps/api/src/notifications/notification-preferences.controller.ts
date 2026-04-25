import { Body, Controller, Get, HttpCode, Inject, Put } from '@nestjs/common';
import {
  NotificationPreferencesPutSchema,
  type NotificationPreferencesPutInput,
} from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { NotificationPreferencesService } from './notification-preferences.service.js';

@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(
    @Inject(NotificationPreferencesService)
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Get()
  @RequirePermission(Permission.NOTIFICATION_READ)
  async get(@CurrentUser() actor: AuthenticatedUser) {
    return this.preferencesService.getResolvedForUser(actor.id);
  }

  @Put()
  @HttpCode(200)
  @RequirePermission(Permission.NOTIFICATION_READ)
  async put(
    @Body(createZodValidationPipe(NotificationPreferencesPutSchema))
    body: NotificationPreferencesPutInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.preferencesService.putPreferences(actor.id, body);
    return { saved: true as const };
  }
}
