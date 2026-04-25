import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProcessesModule } from '../processes/processes.module.js';

import { TaskSlaService } from './task-sla.service.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [PrismaModule, DocumentsModule, ProcessesModule],
  controllers: [TasksController],
  providers: [TasksService, TaskSlaService],
  exports: [TasksService, TaskSlaService],
})
export class TasksModule {}
