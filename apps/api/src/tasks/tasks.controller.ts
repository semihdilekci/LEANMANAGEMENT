import { Controller, Get, HttpCode, Inject, Param, Post, Body, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import {
  TaskCompleteBodySchema,
  TaskListQuerySchema,
  type TaskCompleteBodyInput,
  type TaskListQuery,
} from '@leanmgmt/shared-schemas';

import { Audit } from '../common/decorators/audit.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { TasksService } from './tasks.service.js';

@Controller('tasks')
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}

  @Get()
  async list(
    @Query(createZodValidationPipe(TaskListQuerySchema)) query: TaskListQuery,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.listForActor(query, actor);
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.getDetailById(id, actor);
  }

  @Post(':id/claim')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Audit('CLAIM_TASK', 'task')
  async claim(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.claim(id, actor);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Audit('COMPLETE_TASK', 'task')
  async complete(
    @Param('id') id: string,
    @Body(createZodValidationPipe(TaskCompleteBodySchema)) body: TaskCompleteBodyInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.complete(id, body, actor);
  }
}
