import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessType } from '@leanmgmt/prisma-client';

import { ProcessTypeRegistryService } from './process-type-registry.service.js';
import { KtiWorkflow } from './workflows/kti.workflow.js';
import { ProcessTypeUnknownException } from './processes.exceptions.js';

describe('ProcessTypeRegistryService', () => {
  let registry: ProcessTypeRegistryService;
  let kti: KtiWorkflow;

  beforeEach(() => {
    kti = new KtiWorkflow();
    registry = new ProcessTypeRegistryService(kti);
    registry.onModuleInit();
  });

  it('BEFORE_AFTER_KAIZEN workflow dönner', () => {
    const wf = registry.getWorkflow('BEFORE_AFTER_KAIZEN' as ProcessType);
    expect(wf).toBe(kti);
  });

  it('kayıt yokken getWorkflow → PROCESS_TYPE_UNKNOWN', () => {
    const empty = new ProcessTypeRegistryService(new KtiWorkflow());
    expect(() => empty.getWorkflow('BEFORE_AFTER_KAIZEN' as ProcessType)).toThrow(
      ProcessTypeUnknownException,
    );
  });

  it('aynı tip ikinci kez register — throw', () => {
    expect(() => registry.register('BEFORE_AFTER_KAIZEN' as ProcessType, kti)).toThrow(
      /already registered/,
    );
  });
});
