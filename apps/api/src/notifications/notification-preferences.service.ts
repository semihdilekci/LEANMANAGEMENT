import { Inject, Injectable } from '@nestjs/common';
import type { NotificationEventType } from '@leanmgmt/prisma-client';
import type { NotificationPreferencesPutInput } from '@leanmgmt/shared-schemas';
import { NOTIFICATION_EVENT_TYPES } from '@leanmgmt/shared-schemas';

import { PrismaService } from '../prisma/prisma.service.js';

export type ResolvedNotificationPreference = {
  eventType: NotificationEventType;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  digestEnabled: boolean;
};

/** Tercih satırı yoksa: digest kapalı; in_app + email açık (Faz 7 varsayılan) */
export function defaultPreferenceChannels(): Omit<ResolvedNotificationPreference, 'eventType'> {
  return {
    inAppEnabled: true,
    emailEnabled: true,
    digestEnabled: false,
  };
}

@Injectable()
export class NotificationPreferencesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getResolvedForUser(
    userId: string,
  ): Promise<{ preferences: ResolvedNotificationPreference[] }> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const byEvent = new Map(rows.map((r) => [r.eventType, r]));

    const preferences: ResolvedNotificationPreference[] = NOTIFICATION_EVENT_TYPES.map(
      (eventType: (typeof NOTIFICATION_EVENT_TYPES)[number]) => {
        const et = eventType as NotificationEventType;
        const row = byEvent.get(et);
        const d = defaultPreferenceChannels();
        return {
          eventType: et,
          inAppEnabled: row?.inAppEnabled ?? d.inAppEnabled,
          emailEnabled: row?.emailEnabled ?? d.emailEnabled,
          digestEnabled: row?.digestEnabled ?? d.digestEnabled,
        };
      },
    );

    return { preferences };
  }

  async isInAppEnabled(userId: string, eventType: NotificationEventType): Promise<boolean> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId_eventType: { userId, eventType } },
    });
    if (!row) return defaultPreferenceChannels().inAppEnabled;
    return row.inAppEnabled;
  }

  async isEmailEnabled(userId: string, eventType: NotificationEventType): Promise<boolean> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId_eventType: { userId, eventType } },
    });
    if (!row) return defaultPreferenceChannels().emailEnabled;
    return row.emailEnabled;
  }

  async putPreferences(userId: string, input: NotificationPreferencesPutInput): Promise<void> {
    for (const p of input.preferences) {
      await this.prisma.notificationPreference.upsert({
        where: {
          userId_eventType: { userId, eventType: p.eventType as NotificationEventType },
        },
        create: {
          userId,
          eventType: p.eventType as NotificationEventType,
          inAppEnabled: p.inAppEnabled,
          emailEnabled: p.emailEnabled,
          digestEnabled: p.digestEnabled,
        },
        update: {
          inAppEnabled: p.inAppEnabled,
          emailEnabled: p.emailEnabled,
          digestEnabled: p.digestEnabled,
        },
      });
    }
  }
}
