import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssignmentMode, type Prisma, ProcessType, type TaskStatus } from '@leanmgmt/prisma-client';

import type { KtiStartInput, ProcessListQuery } from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionResolverService } from '../roles/permission-resolver.service.js';

import { NOTIFICATION_DOMAIN_EVENT } from '../notifications/notification-domain.events.js';

import { ProcessTypeRegistryService } from './process-type-registry.service.js';
import {
  KtiCompanyMismatchException,
  KtiManagerRequiredException,
  ProcessInvalidStateException,
  ProcessNotFoundException,
  ProcessViewAccessDeniedException,
} from './processes.exceptions.js';

const ACTIVE_STATUSES: TaskStatus[] = ['PENDING', 'CLAIMED', 'IN_PROGRESS'];

function addHoursToNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function pickActiveStepKeyFromTasks(
  tasks: { stepKey: string; stepOrder: number; status: TaskStatus }[],
): string | null {
  const actives = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status));
  if (actives.length === 0) return null;
  const maxOrder = Math.max(...actives.map((t) => t.stepOrder));
  return actives.find((t) => t.stepOrder === maxOrder)?.stepKey ?? null;
}

@Injectable()
export class ProcessesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProcessTypeRegistryService)
    private readonly processTypeRegistry: ProcessTypeRegistryService,
    @Inject(DocumentsService) private readonly documentsService: DocumentsService,
    @Inject(EventEmitter2) private readonly eventEmitter: EventEmitter2,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
  ) {}

  async startKti(
    dto: KtiStartInput,
    actor: AuthenticatedUser,
  ): Promise<{
    id: string;
    displayId: string;
    processType: ProcessType;
    status: string;
    firstTaskId: string;
    startedAt: string;
  }> {
    const starter = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { managerUserId: true, companyId: true },
    });
    if (!starter) {
      throw new AppException('USER_NOT_FOUND', 'Kullanıcı bulunamadı.', 404);
    }
    if (starter.companyId !== dto.companyId) {
      throw new KtiCompanyMismatchException();
    }
    if (starter.managerUserId === null) {
      throw new KtiManagerRequiredException();
    }
    const allDocIds = [...dto.beforePhotoDocumentIds, ...dto.afterPhotoDocumentIds];
    await this.documentsService.assertKtiPhotoDocumentsCleanAndOwned(actor, allDocIds);

    const workflow = this.processTypeRegistry.getWorkflow(ProcessType.BEFORE_AFTER_KAIZEN);
    const initiationStep = workflow.getStepByOrder(1);
    const approvalStep = workflow.getStepByOrder(2);

    const rows = await this.prisma.$queryRaw<[{ n: bigint }]>`
      SELECT nextval('process_seq_before_after_kaizen') AS n
    `;
    const n = rows[0].n;
    const displayId = `KTI-${String(n).padStart(6, '0')}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const process = await tx.process.create({
        data: {
          processNumber: n,
          processType: ProcessType.BEFORE_AFTER_KAIZEN,
          displayId,
          startedByUserId: actor.id,
          companyId: dto.companyId,
          status: 'IN_PROGRESS',
        },
      });

      await tx.task.create({
        data: {
          processId: process.id,
          stepKey: initiationStep.stepKey,
          stepOrder: initiationStep.order,
          assignmentMode: AssignmentMode.SINGLE,
          status: 'COMPLETED',
          completedByUserId: actor.id,
          completedAt: new Date(),
          formData: {
            beforePhotoDocumentIds: dto.beforePhotoDocumentIds,
            afterPhotoDocumentIds: dto.afterPhotoDocumentIds,
            savingAmount: dto.savingAmount,
            description: dto.description,
          },
        },
      });

      const approvalTask = await tx.task.create({
        data: {
          processId: process.id,
          stepKey: approvalStep.stepKey,
          stepOrder: approvalStep.order,
          assignmentMode: AssignmentMode.SINGLE,
          status: 'PENDING',
          slaDueAt: addHoursToNow(approvalStep.slaHours),
        },
      });

      await tx.taskAssignment.create({
        data: {
          taskId: approvalTask.id,
          userId: starter.managerUserId,
          status: 'PENDING',
          resolvedByRule: true,
        },
      });

      await tx.document.updateMany({
        where: { id: { in: allDocIds } },
        data: {
          processId: process.id,
          taskId: approvalTask.id,
        },
      });

      return { process, approvalTask };
    });

    this.eventEmitter.emit('task.assigned', {
      taskId: result.approvalTask.id,
      userId: starter.managerUserId,
      processDisplayId: displayId,
    });

    return {
      id: result.process.id,
      displayId: result.process.displayId,
      processType: result.process.processType,
      status: result.process.status,
      firstTaskId: result.approvalTask.id,
      startedAt: result.process.startedAt.toISOString(),
    };
  }

  async cancelByDisplayId(
    displayId: string,
    body: { reason: string },
    _actor: AuthenticatedUser,
  ): Promise<void> {
    const process = await this.prisma.process.findFirst({
      where: { displayId },
      include: { startedBy: { select: { id: true, managerUserId: true } } },
    });
    if (!process) {
      throw new ProcessNotFoundException();
    }
    const workflow = this.processTypeRegistry.getWorkflow(process.processType);
    if (!workflow.isCancelableProcessStatus(process.status)) {
      throw new ProcessInvalidStateException();
    }

    await this.prisma.$transaction(async (tx) => {
      const active = await tx.task.findMany({
        where: { processId: process.id, status: { in: ACTIVE_STATUSES } },
        select: { id: true },
      });
      const taskIds = active.map((t) => t.id);
      if (taskIds.length > 0) {
        await tx.task.updateMany({
          where: { id: { in: taskIds } },
          data: { status: 'SKIPPED_BY_ROLLBACK' },
        });
        await tx.taskAssignment.updateMany({
          where: { taskId: { in: taskIds }, status: 'PENDING' },
          data: { status: 'SKIPPED' },
        });
      }
      const now = new Date();
      await tx.process.update({
        where: { id: process.id },
        data: {
          status: 'CANCELLED',
          cancelReason: body.reason,
          cancelledAt: now,
          cancelledByUserId: _actor.id,
        },
      });
    });

    this.eventEmitter.emit(NOTIFICATION_DOMAIN_EVENT.PROCESS_CANCELLED, {
      processId: process.id,
      displayId: process.displayId,
      startedByUserId: process.startedByUserId,
    });
  }

  async rollbackByDisplayId(
    displayId: string,
    body: { targetStepOrder: number; reason: string },
    _actor: AuthenticatedUser,
  ): Promise<{
    newActiveTaskId: string;
    newActiveTaskStepKey: string;
    rolledBackFromStepOrder: number;
  }> {
    const process = await this.prisma.process.findFirst({
      where: { displayId },
      include: { startedBy: { select: { id: true, managerUserId: true } } },
    });
    if (!process) {
      throw new ProcessNotFoundException();
    }
    const workflow = this.processTypeRegistry.getWorkflow(process.processType);
    const tasks = await this.prisma.task.findMany({
      where: { processId: process.id },
    });
    const { currentStepOrder, targetStep } = workflow.assertRollbackTarget({
      processStatus: process.status,
      tasks,
      targetStepOrder: body.targetStepOrder,
    });
    const assigneeUserId = workflow.resolveAssigneeUserIdForStep(targetStep, {
      startedByUserId: process.startedByUserId,
      managerUserId: process.startedBy.managerUserId,
    });
    const result = await this.prisma.$transaction(async (tx) => {
      const active = await tx.task.findMany({
        where: { processId: process.id, status: { in: ACTIVE_STATUSES } },
        select: { id: true },
      });
      const taskIds = active.map((t) => t.id);
      if (taskIds.length > 0) {
        await tx.task.updateMany({
          where: { id: { in: taskIds } },
          data: { status: 'SKIPPED_BY_ROLLBACK' },
        });
        await tx.taskAssignment.updateMany({
          where: { taskId: { in: taskIds }, status: 'PENDING' },
          data: { status: 'SKIPPED' },
        });
      }
      const newTask = await tx.task.create({
        data: {
          processId: process.id,
          stepKey: targetStep.stepKey,
          stepOrder: targetStep.order,
          assignmentMode: AssignmentMode.SINGLE,
          status: 'PENDING',
          slaDueAt: addHoursToNow(targetStep.slaHours),
        },
      });
      await tx.taskAssignment.create({
        data: {
          taskId: newTask.id,
          userId: assigneeUserId,
          status: 'PENDING',
        },
      });
      const nowIso = new Date().toISOString();
      const entry = {
        fromStep: currentStepOrder,
        toStep: targetStep.order,
        reason: body.reason,
        byUserId: _actor.id,
        at: nowIso,
      };
      const previousHistory = Array.isArray(process.rollbackHistory) ? process.rollbackHistory : [];
      const nextHistory = [...(previousHistory as object[]), entry];
      await tx.process.update({
        where: { id: process.id },
        data: { rollbackHistory: nextHistory },
      });
      return {
        newActiveTaskId: newTask.id,
        newActiveTaskStepKey: targetStep.stepKey,
        rolledBackFromStepOrder: currentStepOrder,
      };
    });

    this.eventEmitter.emit(NOTIFICATION_DOMAIN_EVENT.PROCESS_ROLLBACK_PERFORMED, {
      processId: process.id,
      displayId: process.displayId,
      newTaskId: result.newActiveTaskId,
      assigneeUserId,
      startedByUserId: process.startedByUserId,
    });

    return result;
  }

  private buildProcessListWhere(
    query: ProcessListQuery,
    actor: AuthenticatedUser,
  ): Prisma.ProcessWhereInput {
    const where: Prisma.ProcessWhereInput = {};

    if (query.scope === 'my-started') {
      where.startedByUserId = actor.id;
    }

    if (query.processType) {
      where.processType = query.processType;
    }
    if (query.displayId) {
      where.displayId = query.displayId;
    }
    const startedAtFilter: Prisma.DateTimeFilter = {};
    if (query.startedAtFrom) startedAtFilter.gte = new Date(query.startedAtFrom);
    if (query.startedAtTo) startedAtFilter.lte = new Date(query.startedAtTo);
    if (Object.keys(startedAtFilter).length > 0) {
      where.startedAt = startedAtFilter;
    }

    if (query.scope === 'admin') {
      if (query.startedByUserId) where.startedByUserId = query.startedByUserId;
      if (query.companyId) where.companyId = query.companyId;
    }

    if (query.status !== 'all') {
      where.status = query.status;
    } else if (query.scope === 'my-started') {
      where.status = { not: 'CANCELLED' };
    } else if (query.scope === 'admin' && query.showCancelled !== 'true') {
      where.status = { not: 'CANCELLED' };
    }

    return where;
  }

  private serializeUserBrief(u: {
    id: string;
    firstName: string;
    lastName: string;
    sicilEncrypted: Buffer | Uint8Array;
    anonymizedAt: Date | null;
  }): { id: string; firstName: string; lastName: string; sicil: string | null } {
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      sicil: u.anonymizedAt ? null : this.encryption.decryptSicil(u.sicilEncrypted),
    };
  }

  async findManyForActor(
    query: ProcessListQuery,
    actor: AuthenticatedUser,
  ): Promise<{
    items: Record<string, unknown>[];
    pagination: { nextCursor: string | null; hasMore: boolean };
  }> {
    if (query.scope === 'admin') {
      const ok = await this.permissionResolver.hasPermission(actor.id, Permission.PROCESS_VIEW_ALL);
      if (!ok) {
        throw new AppException(
          'PERMISSION_DENIED',
          'Bu işlem için yetkiniz bulunmamaktadır.',
          403,
          {
            required: [Permission.PROCESS_VIEW_ALL],
          },
        );
      }
    }

    const where = this.buildProcessListWhere(query, actor);
    const direction = query.sort === 'started_at_asc' ? ('asc' as const) : ('desc' as const);
    const limit = query.limit;

    const rows = await this.prisma.process.findMany({
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      orderBy: [{ startedAt: direction }, { id: direction }],
      where,
      include: {
        startedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            sicilEncrypted: true,
            anonymizedAt: true,
          },
        },
        company: { select: { id: true, code: true, name: true } },
        tasks: {
          where: { status: { in: ACTIVE_STATUSES } },
          select: { stepKey: true, stepOrder: true, status: true },
        },
      },
    });

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const nextCursor = hasMore ? (rows[rows.length - 1]?.id ?? null) : null;

    const items = rows.map((p) => {
      const wf = this.processTypeRegistry.getWorkflow(p.processType);
      const activeKey = pickActiveStepKeyFromTasks(p.tasks);
      const activeTaskLabel = wf.getListActiveStepLabel(activeKey, p.status);
      return {
        id: p.id,
        displayId: p.displayId,
        processType: p.processType,
        status: p.status,
        startedBy: this.serializeUserBrief(p.startedBy),
        company: { id: p.company.id, code: p.company.code, name: p.company.name },
        activeTaskLabel,
        startedAt: p.startedAt.toISOString(),
        completedAt: p.completedAt?.toISOString() ?? null,
        cancelledAt: p.cancelledAt?.toISOString() ?? null,
      };
    });

    return { items, pagination: { nextCursor, hasMore } };
  }

  async findByDisplayIdForActor(
    displayId: string,
    actor: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const process = await this.prisma.process.findFirst({
      where: { displayId },
      include: {
        startedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            sicilEncrypted: true,
            anonymizedAt: true,
          },
        },
        company: { select: { id: true, code: true, name: true } },
        tasks: {
          orderBy: { stepOrder: 'asc' },
          include: {
            completedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                sicilEncrypted: true,
                anonymizedAt: true,
              },
            },
            assignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    sicilEncrypted: true,
                    anonymizedAt: true,
                  },
                },
              },
            },
          },
        },
        documents: { orderBy: { uploadedAt: 'desc' } },
      },
    });

    if (!process) {
      throw new ProcessNotFoundException();
    }

    const hasViewAll = await this.permissionResolver.hasPermission(
      actor.id,
      Permission.PROCESS_VIEW_ALL,
    );
    const isOwner = process.startedByUserId === actor.id;
    const assigneeLink = await this.prisma.taskAssignment.findFirst({
      where: { userId: actor.id, task: { processId: process.id } },
    });
    const isAssignee = Boolean(assigneeLink);
    if (!isOwner && !hasViewAll && !isAssignee) {
      throw new ProcessViewAccessDeniedException();
    }

    const fullProcessAccess = isOwner || hasViewAll;

    const wf = this.processTypeRegistry.getWorkflow(process.processType);
    const activeKey = pickActiveStepKeyFromTasks(process.tasks);
    const activeTaskLabel = wf.getListActiveStepLabel(activeKey, process.status);

    const taskIdsActorAssigned = new Set(
      process.tasks
        .filter((t) => t.assignments.some((a) => a.userId === actor.id))
        .map((t) => t.id),
    );

    const documentVisible = (taskId: string | null): boolean => {
      if (fullProcessAccess) return true;
      if (!taskId) return false;
      return taskIdsActorAssigned.has(taskId);
    };

    const tasksOut = process.tasks.map((task) => {
      const taskFullAccess = fullProcessAccess || taskIdsActorAssigned.has(task.id);
      const assigneeUser = task.assignments.find((a) => a.user)?.user ?? null;

      const base: Record<string, unknown> = {
        id: task.id,
        stepKey: task.stepKey,
        stepOrder: task.stepOrder,
        status: task.status,
        completedAt: task.completedAt?.toISOString() ?? null,
        completionAction: task.completionAction,
      };

      if (!taskFullAccess) {
        return base;
      }

      if (task.completedBy) {
        base['completedBy'] = this.serializeUserBrief(task.completedBy);
      }
      if (task.status !== 'COMPLETED' && assigneeUser) {
        base['assignedTo'] = this.serializeUserBrief(assigneeUser);
      }
      if (task.slaDueAt) {
        base['slaDueAt'] = task.slaDueAt.toISOString();
      }
      base['formData'] = task.formData ?? null;
      return base;
    });

    const documentsOut = process.documents
      .filter((d) => documentVisible(d.taskId))
      .map((d) => ({
        id: d.id,
        filename: d.originalFilename,
        scanStatus: d.scanStatus,
        thumbnailUrl: null as string | null,
      }));

    return {
      id: process.id,
      displayId: process.displayId,
      processType: process.processType,
      status: process.status,
      activeTaskLabel,
      startedBy: this.serializeUserBrief(process.startedBy),
      company: { id: process.company.id, code: process.company.code, name: process.company.name },
      startedAt: process.startedAt.toISOString(),
      completedAt: process.completedAt?.toISOString() ?? null,
      cancelledAt: process.cancelledAt?.toISOString() ?? null,
      cancelReason: fullProcessAccess ? process.cancelReason : null,
      tasks: tasksOut,
      documents: documentsOut,
    };
  }
}
