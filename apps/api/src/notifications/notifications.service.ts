import { Inject, Injectable } from '@nestjs/common';
import type { NotificationChannel, NotificationEventType, Prisma } from '@leanmgmt/prisma-client';
import type { NotificationListQuery } from '@leanmgmt/shared-schemas';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { NotificationEmailQueueService } from './notification-email-queue.service.js';
import { NotificationNotFoundException } from './notifications.exceptions.js';
import { NotificationPreferencesService } from './notification-preferences.service.js';

export type CreateInAppNotificationInput = {
  userId: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  linkUrl?: string | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationPreferencesService)
    private readonly preferences: NotificationPreferencesService,
    @Inject(NotificationEmailQueueService)
    private readonly emailQueue: NotificationEmailQueueService,
  ) {}

  /** Generator tarafından: tercih kapalıysa no-op */
  async createInAppIfEnabled(input: CreateInAppNotificationInput): Promise<void> {
    const ok = await this.preferences.isInAppEnabled(input.userId, input.eventType);
    if (!ok) return;

    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        channel: 'IN_APP',
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl ?? null,
        metadata: input.metadata ?? undefined,
        deliveryStatus: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  /** In-app + e-posta kuyruğu; e-posta kapalı veya şablon yoksa e-posta atlanır */
  async createInAppAndEmailIfEnabled(input: CreateInAppNotificationInput): Promise<void> {
    await this.createInAppIfEnabled(input);
    await this.createEmailPendingIfEnabled(input);
  }

  /** Şablon DB’de yoksa no-op — worker şablonu kullanır */
  async createEmailPendingIfEnabled(input: CreateInAppNotificationInput): Promise<void> {
    const emailOn = await this.preferences.isEmailEnabled(input.userId, input.eventType);
    if (!emailOn) return;

    const tpl = await this.prisma.emailTemplate.findUnique({
      where: { eventType: input.eventType },
    });
    if (!tpl) return;

    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        channel: 'EMAIL',
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl ?? null,
        metadata: input.metadata ?? undefined,
        deliveryStatus: 'PENDING',
        sentAt: new Date(),
      },
    });
    await this.emailQueue.enqueueEmail(row.id);
  }

  private buildListWhere(
    userId: string,
    query: NotificationListQuery,
  ): Prisma.NotificationWhereInput {
    const where: Prisma.NotificationWhereInput = { userId };

    if (query.channel === 'IN_APP') {
      where.channel = 'IN_APP';
    } else if (query.channel === 'EMAIL') {
      where.channel = 'EMAIL';
    }

    if (query.isRead === 'true') {
      where.readAt = { not: null };
    } else if (query.isRead === 'false') {
      where.readAt = null;
    }

    if (query.eventType) {
      where.eventType = query.eventType as NotificationEventType;
    }

    return where;
  }

  async listForActor(
    query: NotificationListQuery,
    actor: AuthenticatedUser,
  ): Promise<{
    items: Record<string, unknown>[];
    pagination: {
      nextCursor: string | null;
      hasMore: boolean;
      limit: number;
      total: number;
    };
  }> {
    const limit = query.limit;
    const where = this.buildListWhere(actor.id, query);

    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        take: limit + 1,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        skip: query.cursor ? 1 : 0,
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    const items = page.map((n) => this.serializeNotification(n));
    return {
      items,
      pagination: { nextCursor, hasMore, limit, total },
    };
  }

  private serializeNotification(n: {
    id: string;
    eventType: NotificationEventType;
    channel: NotificationChannel;
    title: string;
    body: string;
    linkUrl: string | null;
    metadata: unknown;
    readAt: Date | null;
    sentAt: Date;
    deliveryStatus: string;
  }): Record<string, unknown> {
    return {
      id: n.id,
      eventType: n.eventType,
      channel: n.channel,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl,
      metadata: n.metadata,
      readAt: n.readAt?.toISOString() ?? null,
      sentAt: n.sentAt.toISOString(),
      deliveryStatus: n.deliveryStatus,
    };
  }

  async unreadInAppCount(actor: AuthenticatedUser): Promise<{ inAppUnreadCount: number }> {
    const inAppUnreadCount = await this.prisma.notification.count({
      where: { userId: actor.id, channel: 'IN_APP', readAt: null },
    });
    return { inAppUnreadCount };
  }

  async markRead(actor: AuthenticatedUser, notificationId: string): Promise<void> {
    const n = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId: actor.id },
    });
    if (!n) {
      throw new NotificationNotFoundException();
    }
    if (n.readAt !== null) {
      return;
    }
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(actor: AuthenticatedUser): Promise<{ markedCount: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { userId: actor.id, channel: 'IN_APP', readAt: null },
      data: { readAt: new Date() },
    });
    return { markedCount: res.count };
  }
}
