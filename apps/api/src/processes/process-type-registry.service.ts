import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ProcessType } from '@leanmgmt/prisma-client';

import type { ProcessWorkflow } from './workflows/base-workflow.interface.js';
import { KtiWorkflow } from './workflows/kti.workflow.js';
import { ProcessTypeUnknownException } from './processes.exceptions.js';

@Injectable()
export class ProcessTypeRegistryService implements OnModuleInit {
  private readonly workflows = new Map<ProcessType, ProcessWorkflow>();

  constructor(@Inject(KtiWorkflow) private readonly ktiWorkflow: KtiWorkflow) {}

  onModuleInit(): void {
    this.register(this.ktiWorkflow.processType, this.ktiWorkflow);
  }

  register(type: ProcessType, workflow: ProcessWorkflow): void {
    if (this.workflows.has(type)) {
      throw new Error(`Process type already registered: ${String(type)}`);
    }
    this.workflows.set(type, workflow);
  }

  getWorkflow(type: ProcessType): ProcessWorkflow {
    const w = this.workflows.get(type);
    if (!w) {
      throw new ProcessTypeUnknownException();
    }
    return w;
  }
}
