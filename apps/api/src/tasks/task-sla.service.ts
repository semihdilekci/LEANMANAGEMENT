import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

const ACTIVE: Array<'PENDING' | 'CLAIMED' | 'IN_PROGRESS'> = ['PENDING', 'CLAIMED', 'IN_PROGRESS'];

@Injectable()
export class TaskSlaService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** docs/01_DOMAIN_MODEL + Faz 6: sla_due_at geçti, aşım bayrağı */
  async markOverdueTasks(): Promise<{ updated: number }> {
    const now = new Date();
    const r = await this.prisma.task.updateMany({
      where: {
        status: { in: ACTIVE },
        slaDueAt: { not: null, lt: now },
        isSlaOverdue: false,
      },
      data: { isSlaOverdue: true },
    });
    return { updated: r.count };
  }
}
