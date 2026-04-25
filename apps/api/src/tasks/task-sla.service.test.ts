import { describe, expect, it, vi, beforeEach } from 'vitest';

import { TaskSlaService } from './task-sla.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('TaskSlaService', () => {
  let service: TaskSlaService;
  const updateMany = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const prisma = {
      task: { updateMany },
    } as unknown as PrismaService;
    service = new TaskSlaService(prisma);
  });

  it('geçmiş sla_due_at satırlarını isSlaOverdue true yapar', async () => {
    updateMany.mockResolvedValue({ count: 2 });
    const r = await service.markOverdueTasks();
    expect(r.updated).toBe(2);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isSlaOverdue: true },
      }),
    );
  });
});
