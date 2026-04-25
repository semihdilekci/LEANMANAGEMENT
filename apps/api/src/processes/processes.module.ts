import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { ProcessTypeRegistryService } from './process-type-registry.service.js';
import { ProcessesController } from './processes.controller.js';
import { ProcessesService } from './processes.service.js';
import { KtiWorkflow } from './workflows/kti.workflow.js';

@Module({
  imports: [PrismaModule, DocumentsModule],
  controllers: [ProcessesController],
  providers: [ProcessesService, KtiWorkflow, ProcessTypeRegistryService],
  exports: [ProcessesService, ProcessTypeRegistryService, KtiWorkflow],
})
export class ProcessesModule {}
