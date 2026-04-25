import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { NotificationEventType } from '@leanmgmt/prisma-client';

import { PrismaService } from '../prisma/prisma.service.js';
import { getKtiTaskStepLabel } from '../tasks/kti-task-step.js';

import {
  NOTIFICATION_DOMAIN_EVENT,
  type ProcessCancelledPayload,
  type ProcessRollbackPerformedPayload,
  type TaskAssignedPayload,
  type TaskClaimedByPeerPayload,
  type TaskCompletedPayload,
} from './notification-domain.events.js';
import { NotificationsService } from './notifications.service.js';

@Injectable()
export class NotificationGeneratorService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(NOTIFICATION_DOMAIN_EVENT.TASK_ASSIGNED, { async: true })
  async handleTaskAssigned(payload: TaskAssignedPayload): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id: payload.taskId },
      include: { process: { select: { id: true, displayId: true } } },
    });
    if (!task) return;

    const displayId = payload.processDisplayId ?? task.process.displayId;
    const stepLabel = getKtiTaskStepLabel(task.stepKey);
    await this.notifications.createInAppAndEmailIfEnabled({
      userId: payload.userId,
      eventType: 'TASK_ASSIGNED',
      title: 'Yeni görev atandı',
      body: `[${displayId}] sürecinde “${stepLabel}” adımı için görev atandı.`,
      linkUrl: `/tasks/${task.id}`,
      metadata: {
        processId: task.processId,
        taskId: task.id,
        displayId,
        taskTitle: stepLabel,
      },
    });
  }

  @OnEvent(NOTIFICATION_DOMAIN_EVENT.TASK_CLAIMED_BY_PEER, { async: true })
  async handleTaskClaimedByPeer(payload: TaskClaimedByPeerPayload): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id: payload.taskId },
      include: { process: { select: { displayId: true } } },
    });
    if (!task) return;

    const displayId = task.process.displayId;
    const taskTitle = getKtiTaskStepLabel(task.stepKey);
    for (const userId of payload.skippedUserIds) {
      await this.notifications.createInAppAndEmailIfEnabled({
        userId,
        eventType: 'TASK_CLAIMED_BY_PEER',
        title: 'Görev başka kullanıcı tarafından üstlenildi',
        body: `[${displayId}] sürecindeki görevi başka bir aday üstlendi; sizin adaylığınız sonlandı.`,
        linkUrl: `/tasks/${task.id}`,
        metadata: { processId: task.processId, taskId: task.id, displayId, taskTitle },
      });
    }
  }

  @OnEvent(NOTIFICATION_DOMAIN_EVENT.TASK_COMPLETED, { async: true })
  async handleTaskCompleted(payload: TaskCompletedPayload): Promise<void> {
    const process = await this.prisma.process.findFirst({
      where: { id: payload.processId },
      select: { id: true, displayId: true, status: true, startedByUserId: true },
    });
    if (!process) return;

    if (process.status !== 'COMPLETED' && process.status !== 'REJECTED') {
      return;
    }

    const eventType: NotificationEventType =
      process.status === 'COMPLETED' ? 'PROCESS_COMPLETED' : 'PROCESS_REJECTED';

    const title = eventType === 'PROCESS_COMPLETED' ? 'Süreç tamamlandı' : 'Süreç reddedildi';
    const body =
      eventType === 'PROCESS_COMPLETED'
        ? `[${process.displayId}] Kaizen süreci onaylandı ve tamamlandı.`
        : `[${process.displayId}] Kaizen süreci yönetici tarafından reddedildi.`;

    await this.notifications.createInAppAndEmailIfEnabled({
      userId: process.startedByUserId,
      eventType,
      title,
      body,
      linkUrl: `/processes/${encodeURIComponent(process.displayId)}`,
      metadata: {
        processId: process.id,
        taskId: payload.taskId,
        displayId: process.displayId,
      },
    });
  }

  @OnEvent(NOTIFICATION_DOMAIN_EVENT.PROCESS_CANCELLED, { async: true })
  async handleProcessCancelled(payload: ProcessCancelledPayload): Promise<void> {
    await this.notifications.createInAppAndEmailIfEnabled({
      userId: payload.startedByUserId,
      eventType: 'PROCESS_CANCELLED',
      title: 'Süreç iptal edildi',
      body: `[${payload.displayId}] süreci iptal edildi.`,
      linkUrl: `/processes/${encodeURIComponent(payload.displayId)}`,
      metadata: { processId: payload.processId, displayId: payload.displayId },
    });
  }

  @OnEvent(NOTIFICATION_DOMAIN_EVENT.PROCESS_ROLLBACK_PERFORMED, { async: true })
  async handleProcessRollback(payload: ProcessRollbackPerformedPayload): Promise<void> {
    const newTask = await this.prisma.task.findFirst({
      where: { id: payload.newTaskId },
      select: { stepKey: true },
    });
    const taskTitle = newTask ? getKtiTaskStepLabel(newTask.stepKey) : '';
    const recipients = new Set<string>([payload.assigneeUserId, payload.startedByUserId]);

    for (const userId of recipients) {
      await this.notifications.createInAppAndEmailIfEnabled({
        userId,
        eventType: 'ROLLBACK_PERFORMED',
        title: 'Süreç adımı geri alındı',
        body: `[${payload.displayId}] sürecinde geri alma uygulandı; yeni aktif görev oluşturuldu.`,
        linkUrl: `/tasks/${payload.newTaskId}`,
        metadata: {
          processId: payload.processId,
          taskId: payload.newTaskId,
          displayId: payload.displayId,
          taskTitle,
        },
      });
    }
  }
}
