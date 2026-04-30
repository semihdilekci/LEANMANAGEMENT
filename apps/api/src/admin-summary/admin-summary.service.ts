import { Inject, Injectable } from '@nestjs/common';
import { ProcessStatus, TaskStatus } from '@leanmgmt/prisma-client';
import type { AdminOrganizationSummary } from '@leanmgmt/shared-schemas';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminSummaryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOrganizationSummary(): Promise<AdminOrganizationSummary> {
    const [activeUserCount, openProcessCount, overdueTaskCount] = await Promise.all([
      this.prisma.user.count({
        where: { isActive: true, anonymizedAt: null },
      }),
      this.prisma.process.count({
        where: { status: { in: [ProcessStatus.INITIATED, ProcessStatus.IN_PROGRESS] } },
      }),
      this.prisma.task.count({
        where: {
          isSlaOverdue: true,
          status: { in: [TaskStatus.PENDING, TaskStatus.CLAIMED, TaskStatus.IN_PROGRESS] },
        },
      }),
    ]);
    return { activeUserCount, openProcessCount, overdueTaskCount };
  }
}
