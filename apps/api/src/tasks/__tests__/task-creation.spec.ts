import { describe, expect, it } from 'vitest';

import { KtiWorkflow } from '../../processes/workflows/kti.workflow.js';

/**
 * `sla_due_at` yazımı ProcessesService + TasksService içinde `KtiWorkflow` SLA saatleriyle hizalıdır;
 * uçtan uca doğrulama: `apps/api/test/documents-kti.integration.test.ts` (KTİ start → yönetici task).
 */
describe('Task oluşturma — SLA tanımı (KTİ workflow)', () => {
  it('yönetici onay ve revize adımları beklenen saat SLA ile tanımlı', () => {
    const wf = new KtiWorkflow();
    expect(wf.getStepByOrder(2).slaHours).toBe(72);
    expect(wf.getStepByOrder(3).slaHours).toBe(48);
  });
});
