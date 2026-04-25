import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { NotificationEmailQueueService } from './notification-email-queue.service.js';
import { NotificationGeneratorService } from './notification-generator.service.js';
import { NotificationPreferencesController } from './notification-preferences.controller.js';
import { NotificationPreferencesService } from './notification-preferences.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController, NotificationPreferencesController],
  providers: [
    NotificationPreferencesService,
    NotificationEmailQueueService,
    NotificationsService,
    NotificationGeneratorService,
  ],
  exports: [NotificationsService, NotificationPreferencesService],
})
export class NotificationsModule {}
