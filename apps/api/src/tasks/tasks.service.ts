import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AssignmentMode,
  Prisma,
  ProcessType,
  type Task,
  type TaskStatus,
} from '@leanmgmt/prisma-client';

import type { KtiStartInput, TaskCompleteBodyInput, TaskListQuery } from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionResolverService } from '../roles/permission-resolver.service.js';
import {
  KtiCompanyMismatchException,
  KtiManagerRequiredException,
} from '../processes/processes.exceptions.js';
import { KtiWorkflow } from '../processes/workflows/kti.workflow.js';

import {
  getKtiFormSchemaForApiResponse,
  getKtiManagerAllowedActions,
  getKtiReasonRequiredForManager,
  getKtiTaskStepLabel,
  KTI_STEP,
  parseKtiManagerFormData,
  parseKtiRevisionFormData,
} from './kti-task-step.js';
import {
  KtiNotSupportedException,
  TaskAccessDeniedException,
  TaskAlreadyCompletedException,
  TaskCompletionActionInvalidException,
  TaskClaimLostException,
  TaskInvalidStateException,
  TaskMustClaimFirstException,
  TaskNotClaimableException,
  TaskNotFoundException,
  TaskReasonRequiredException,
} from './tasks.exceptions.js';

const ACTIVE: TaskStatus[] = ['PENDING', 'CLAIMED', 'IN_PROGRESS'];
const COMPLETED: TaskStatus = 'COMPLETED';

function addHoursToNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

@Injectable()
export class TasksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
    @Inject(DocumentsService) private readonly documentsService: DocumentsService,
    @Inject(KtiWorkflow) private readonly ktiWorkflow: KtiWorkflow,
    @Inject(EventEmitter2) private readonly eventEmitter: EventEmitter2,
  ) {}

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

  private async assertTaskDetailReadable(
    task: { id: string; process: { id: string; startedByUserId: string } },
    actor: AuthenticatedUser,
  ): Promise<{ hasViewAll: boolean; isAssignee: boolean; isStarter: boolean }> {
    const hasViewAll = await this.permissionResolver.hasPermission(
      actor.id,
      Permission.PROCESS_VIEW_ALL,
    );
    const isStarter = task.process.startedByUserId === actor.id;
    const isAssignee = await this.prisma.taskAssignment.findFirst({
      where: {
        taskId: task.id,
        userId: actor.id,
        status: { in: ['PENDING', 'COMPLETED', 'SKIPPED'] },
      },
    });
    if (!isStarter && !hasViewAll && !isAssignee) {
      throw new TaskAccessDeniedException();
    }
    return { hasViewAll, isAssignee: Boolean(isAssignee), isStarter };
  }

  async listForActor(
    query: TaskListQuery,
    actor: AuthenticatedUser,
  ): Promise<{
    items: Record<string, unknown>[];
    pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
  }> {
    const limit = query.limit;
    const processPart: Prisma.ProcessWhereInput = {
      processType: query.processType ?? ProcessType.BEFORE_AFTER_KAIZEN,
    };
    if (query.startedAtFrom || query.startedAtTo) {
      processPart.startedAt = {
        gte: query.startedAtFrom ? new Date(query.startedAtFrom) : undefined,
        lte: query.startedAtTo ? new Date(query.startedAtTo) : undefined,
      };
    }
    if (query.search) {
      processPart.displayId = { contains: query.search, mode: 'insensitive' };
    }
    const where: Prisma.TaskWhereInput = { process: processPart };
    if (query.tab === 'pending') {
      where.status = { in: ACTIVE };
      where.assignments = { some: { userId: actor.id, status: 'PENDING' } };
    } else if (query.tab === 'completed') {
      where.status = 'COMPLETED';
      where.completedByUserId = actor.id;
    } else {
      where.status = { in: ACTIVE };
      processPart.startedByUserId = actor.id;
      processPart.status = 'IN_PROGRESS';
    }

    const orderBy: Prisma.TaskOrderByWithRelationInput[] =
      query.tab === 'completed'
        ? [{ completedAt: 'desc' }, { id: 'desc' }]
        : [{ slaDueAt: 'asc' }, { id: 'asc' }];

    const rows = await this.prisma.task.findMany({
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      where,
      orderBy,
      include: {
        process: {
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
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const nextCursor = hasMore ? (rows[rows.length - 1]?.id ?? null) : null;

    const items = rows.map((t) => {
      const base: Record<string, unknown> = {
        taskId: t.id,
        stepKey: t.stepKey,
        stepLabel: getKtiTaskStepLabel(t.stepKey),
        status: t.status,
        slaDueAt: t.slaDueAt?.toISOString() ?? null,
        slaBaselineAt: t.createdAt.toISOString(),
        isSlaOverdue: t.isSlaOverdue,
        assignmentMode: t.assignmentMode,
        process: {
          id: t.process.id,
          displayId: t.process.displayId,
          processType: t.process.processType,
          status: t.process.status,
          startedBy: this.serializeUserBrief(t.process.startedBy),
          startedAt: t.process.startedAt.toISOString(),
        },
      };
      if (query.tab === 'completed') {
        base['completedAt'] = t.completedAt?.toISOString() ?? null;
        base['completionAction'] = t.completionAction ?? null;
      }
      return base;
    });

    return { items, pagination: { nextCursor, hasMore, limit } };
  }

  async getDetailById(taskId: string, actor: AuthenticatedUser): Promise<Record<string, unknown>> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, process: { processType: ProcessType.BEFORE_AFTER_KAIZEN } },
      include: {
        process: {
          include: {
            startedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                sicilEncrypted: true,
                anonymizedAt: true,
                company: { select: { id: true, code: true, name: true } },
              },
            },
            company: { select: { id: true, code: true, name: true } },
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
        completedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            sicilEncrypted: true,
            anonymizedAt: true,
          },
        },
      },
    });
    if (!task) {
      throw new TaskNotFoundException();
    }
    const { hasViewAll, isAssignee, isStarter } = await this.assertTaskDetailReadable(
      { ...task, process: { id: task.process.id, startedByUserId: task.process.startedByUserId } },
      actor,
    );
    const fullProcessAccess = isStarter || hasViewAll;
    const taskFullAccess = fullProcessAccess || isAssignee;

    const previousEnriched = taskFullAccess
      ? await this.enrichPreviousTasksIfNeeded(task.process.id, task.id)
      : [];

    const documents = taskFullAccess
      ? await this.prisma.document.findMany({
          where: { taskId: task.id },
          orderBy: { uploadedAt: 'desc' },
          select: { id: true, originalFilename: true, scanStatus: true },
        })
      : [];

    const out: Record<string, unknown> = {
      id: task.id,
      stepKey: task.stepKey,
      stepLabel: getKtiTaskStepLabel(task.stepKey),
      status: task.status,
      assignmentMode: task.assignmentMode,
      slaDueAt: task.slaDueAt?.toISOString() ?? null,
      slaBaselineAt: task.createdAt.toISOString(),
      isSlaOverdue: task.isSlaOverdue,
    };

    if (task.stepKey === KTI_STEP.MANAGER_APPROVAL) {
      out['allowedActions'] = getKtiManagerAllowedActions();
      out['reasonRequiredFor'] = getKtiReasonRequiredForManager();
    } else if (task.stepKey === KTI_STEP.REVISION) {
      out['allowedActions'] = [] as string[];
      out['reasonRequiredFor'] = [] as string[];
    } else {
      out['allowedActions'] = [] as string[];
      out['reasonRequiredFor'] = [] as string[];
    }

    out['formSchema'] = getKtiFormSchemaForApiResponse(task.stepKey);
    out['process'] = {
      id: task.process.id,
      displayId: task.process.displayId,
      processType: task.process.processType,
      status: task.process.status,
      startedBy: this.serializeUserBrief(task.process.startedBy),
      company: {
        id: task.process.company.id,
        code: task.process.company.code,
        name: task.process.company.name,
      },
    };
    out['previousTasks'] = previousEnriched;
    out['documents'] = documents;

    if (taskFullAccess) {
      out['formData'] = task.formData ?? null;
    }
    return out;
  }

  private async enrichPreviousTasksIfNeeded(
    processId: string,
    currentTaskId: string,
  ): Promise<Record<string, unknown>[]> {
    const done = await this.prisma.task.findMany({
      where: { processId, id: { not: currentTaskId }, status: 'COMPLETED' },
      orderBy: { completedAt: 'asc' },
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
      },
    });
    return done.map((t) => ({
      stepKey: t.stepKey,
      stepLabel: getKtiTaskStepLabel(t.stepKey),
      completedBy: t.completedBy ? this.serializeUserBrief(t.completedBy) : null,
      completedAt: t.completedAt?.toISOString() ?? null,
      formData: t.formData ?? null,
    }));
  }

  async claim(
    taskId: string,
    actor: AuthenticatedUser,
  ): Promise<{ taskId: string; claimedAt: string }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`);
      const task = await tx.task.findFirst({
        where: { id: taskId },
        include: { assignments: true, process: true },
      });
      if (!task) {
        throw new TaskNotFoundException();
      }
      if (task.process.processType !== ProcessType.BEFORE_AFTER_KAIZEN) {
        throw new KtiNotSupportedException();
      }
      if (task.assignmentMode !== AssignmentMode.CLAIM) {
        throw new TaskNotClaimableException();
      }
      if (task.status === COMPLETED || task.status === 'SKIPPED_BY_ROLLBACK') {
        throw new TaskAlreadyCompletedException();
      }
      if (task.status === 'CLAIMED') {
        if (task.claimedByUserId === actor.id) {
          return { taskId, claimedAt: task.updatedAt.toISOString() };
        }
        throw new TaskClaimLostException();
      }
      if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
        throw new TaskNotClaimableException();
      }
      const mine = task.assignments.find((a) => a.userId === actor.id && a.status === 'PENDING');
      if (!mine) {
        throw new TaskAccessDeniedException();
      }
      const others = task.assignments.filter(
        (a) => a.userId !== actor.id && a.status === 'PENDING',
      );
      const now = new Date();
      await tx.task.update({
        where: { id: taskId },
        data: { status: 'CLAIMED', claimedByUserId: actor.id },
      });
      for (const o of others) {
        if (o.id) {
          await tx.taskAssignment.update({
            where: { id: o.id },
            data: { status: 'SKIPPED' },
          });
        }
      }
      const skippedUserIds = others.map((o) => o.userId).filter((x): x is string => Boolean(x));
      this.eventEmitter.emit('task.claimed_by_peer', { taskId, skippedUserIds });
      return { taskId, claimedAt: now.toISOString() };
    });
  }

  async complete(
    taskId: string,
    body: TaskCompleteBodyInput,
    actor: AuthenticatedUser,
  ): Promise<{
    taskId: string;
    status: string;
    completedAt: string;
    nextTaskId: string | null;
    processStatus: string;
  }> {
    let revisionForm: KtiStartInput | null = null;
    const pre = await this.prisma.task.findFirst({
      where: { id: taskId },
      include: { process: true },
    });
    if (!pre) {
      throw new TaskNotFoundException();
    }
    if (pre.process.processType !== ProcessType.BEFORE_AFTER_KAIZEN) {
      throw new KtiNotSupportedException();
    }
    if (pre.stepKey === KTI_STEP.REVISION) {
      if (body.action) {
        throw new TaskCompletionActionInvalidException();
      }
      revisionForm = parseKtiRevisionFormData(body.formData);
      await this.documentsService.assertKtiPhotoDocumentsCleanAndOwned(actor, [
        ...revisionForm.beforePhotoDocumentIds,
        ...revisionForm.afterPhotoDocumentIds,
      ]);
      if (actor.id !== pre.process.startedByUserId) {
        throw new TaskAccessDeniedException();
      }
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`);
      const task = await tx.task.findFirst({
        where: { id: taskId },
        include: { process: true, assignments: true },
      });
      if (!task) {
        throw new TaskNotFoundException();
      }
      if (
        task.status === COMPLETED ||
        task.status === 'SKIPPED_BY_ROLLBACK' ||
        task.status === 'SKIPPED_BY_PEER'
      ) {
        throw new TaskAlreadyCompletedException();
      }
      if (task.status !== 'PENDING' && task.status !== 'CLAIMED' && task.status !== 'IN_PROGRESS') {
        throw new TaskInvalidStateException();
      }
      if (task.process.status !== 'IN_PROGRESS') {
        throw new TaskInvalidStateException();
      }
      const assign = await tx.taskAssignment.findFirst({
        where: { taskId, userId: actor.id, status: 'PENDING' },
      });
      if (!assign) {
        throw new TaskAccessDeniedException();
      }
      if (
        task.assignmentMode === 'CLAIM' &&
        (task.status !== 'CLAIMED' || task.claimedByUserId !== actor.id)
      ) {
        if (task.status === 'PENDING') {
          throw new TaskMustClaimFirstException();
        }
        throw new TaskAccessDeniedException();
      }
      if (task.stepKey === KTI_STEP.MANAGER_APPROVAL) {
        return this.completeKtiManager(tx, task, body, actor);
      }
      if (task.stepKey === KTI_STEP.REVISION) {
        if (!revisionForm) {
          throw new AppException('VALIDATION_FAILED', 'Formu kontrol edin.', 400);
        }
        return this.completeKtiRevisionInTx(tx, task, actor, revisionForm);
      }
      if (task.stepKey === KTI_STEP.INITIATION) {
        throw new TaskInvalidStateException();
      }
      throw new KtiNotSupportedException();
    });
  }

  private async completeKtiManager(
    tx: Prisma.TransactionClient,
    task: Task & { process: { id: string; startedByUserId: string; processType: ProcessType } },
    body: TaskCompleteBodyInput,
    actor: AuthenticatedUser,
  ): Promise<{
    taskId: string;
    status: string;
    completedAt: string;
    nextTaskId: string | null;
    processStatus: string;
  }> {
    const action = body.action;
    if (!action) {
      throw new TaskCompletionActionInvalidException();
    }
    if (action !== 'APPROVE' && action !== 'REJECT' && action !== 'REQUEST_REVISION') {
      throw new TaskCompletionActionInvalidException();
    }
    if (getKtiReasonRequiredForManager().includes(action)) {
      if (!body.reason || body.reason.length < 10) {
        throw new TaskReasonRequiredException();
      }
    }
    parseKtiManagerFormData(body.formData);
    const now = new Date();
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: 'COMPLETED',
        completedByUserId: actor.id,
        completedAt: now,
        completionAction: action,
        completionReason: body.reason ?? null,
        formData:
          body.formData === undefined ? undefined : (body.formData as Prisma.InputJsonValue),
      },
    });
    await tx.taskAssignment.updateMany({
      where: { taskId: task.id, userId: actor.id, status: 'PENDING' },
      data: { status: 'COMPLETED', completedAt: now },
    });
    if (action === 'APPROVE') {
      await tx.process.update({
        where: { id: task.processId },
        data: { status: 'COMPLETED', completedAt: now },
      });
      this.eventEmitter.emit('task.completed', { taskId: task.id, processId: task.processId });
      return {
        taskId: task.id,
        status: 'COMPLETED',
        completedAt: now.toISOString(),
        nextTaskId: null,
        processStatus: 'COMPLETED',
      };
    }
    if (action === 'REJECT') {
      await tx.process.update({
        where: { id: task.processId },
        data: { status: 'REJECTED', completedAt: now },
      });
      this.eventEmitter.emit('task.completed', { taskId: task.id, processId: task.processId });
      return {
        taskId: task.id,
        status: 'COMPLETED',
        completedAt: now.toISOString(),
        nextTaskId: null,
        processStatus: 'REJECTED',
      };
    }
    const step3 = this.ktiWorkflow.getStepByOrder(3);
    const newRev = await tx.task.create({
      data: {
        processId: task.processId,
        stepKey: step3.stepKey,
        stepOrder: step3.order,
        assignmentMode: AssignmentMode.SINGLE,
        status: 'PENDING',
        slaDueAt: addHoursToNow(step3.slaHours),
      },
    });
    await tx.taskAssignment.create({
      data: {
        taskId: newRev.id,
        userId: task.process.startedByUserId,
        status: 'PENDING',
      },
    });
    this.eventEmitter.emit('task.assigned', {
      taskId: newRev.id,
      userId: task.process.startedByUserId,
    });
    return {
      taskId: task.id,
      status: 'COMPLETED',
      completedAt: now.toISOString(),
      nextTaskId: newRev.id,
      processStatus: 'IN_PROGRESS',
    };
  }

  private async completeKtiRevisionInTx(
    tx: Prisma.TransactionClient,
    task: Task & {
      process: {
        id: string;
        startedByUserId: string;
        processType: ProcessType;
        companyId: string;
      };
    },
    actor: AuthenticatedUser,
    form: KtiStartInput,
  ): Promise<{
    taskId: string;
    status: string;
    completedAt: string;
    nextTaskId: string | null;
    processStatus: string;
  }> {
    if (form.companyId !== task.process.companyId) {
      throw new KtiCompanyMismatchException();
    }
    const startedBy = await tx.user.findUniqueOrThrow({
      where: { id: task.process.startedByUserId },
      select: { managerUserId: true, companyId: true },
    });
    if (startedBy.companyId !== form.companyId) {
      throw new KtiCompanyMismatchException();
    }
    if (startedBy.managerUserId === null) {
      throw new KtiManagerRequiredException();
    }
    const step2 = this.ktiWorkflow.getStepByOrder(2);
    const now = new Date();
    const formDataJson = { ...form } as unknown as Prisma.InputJsonValue;
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: 'COMPLETED',
        completedByUserId: actor.id,
        completedAt: now,
        formData: formDataJson,
      },
    });
    await tx.taskAssignment.updateMany({
      where: { taskId: task.id, userId: actor.id, status: 'PENDING' },
      data: { status: 'COMPLETED', completedAt: now },
    });
    const next = await tx.task.create({
      data: {
        processId: task.processId,
        stepKey: step2.stepKey,
        stepOrder: step2.order,
        assignmentMode: AssignmentMode.SINGLE,
        status: 'PENDING',
        slaDueAt: addHoursToNow(step2.slaHours),
      },
    });
    await tx.taskAssignment.create({
      data: {
        taskId: next.id,
        userId: startedBy.managerUserId,
        status: 'PENDING',
        resolvedByRule: true,
      },
    });
    const allDocIds = [...form.beforePhotoDocumentIds, ...form.afterPhotoDocumentIds];
    await tx.document.updateMany({
      where: { id: { in: allDocIds } },
      data: { processId: task.processId, taskId: next.id },
    });
    this.eventEmitter.emit('task.assigned', {
      taskId: next.id,
      userId: startedBy.managerUserId,
    });
    return {
      taskId: task.id,
      status: 'COMPLETED',
      completedAt: now.toISOString(),
      nextTaskId: next.id,
      processStatus: 'IN_PROGRESS',
    };
  }
}
