import { Controller, Get, Header, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { Permission } from '@leanmgmt/shared-types';

import { NotificationListQuerySchema, type NotificationListQuery } from '@leanmgmt/shared-schemas';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
  ) {}

  @Get('unread-count')
  @RequirePermission(Permission.NOTIFICATION_READ)
  @Header('Cache-Control', 'no-store')
  async unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.unreadInAppCount(actor);
  }

  @Post('mark-all-read')
  @HttpCode(200)
  @RequirePermission(Permission.NOTIFICATION_READ)
  async markAllRead(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.markAllRead(actor);
  }

  @Post(':id/mark-read')
  @HttpCode(204)
  @RequirePermission(Permission.NOTIFICATION_READ)
  async markRead(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser): Promise<void> {
    await this.notificationsService.markRead(actor, id);
  }

  @Get()
  @RequirePermission(Permission.NOTIFICATION_READ)
  async list(
    @Query(createZodValidationPipe(NotificationListQuerySchema)) query: NotificationListQuery,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.notificationsService.listForActor(query, actor);
  }
}
