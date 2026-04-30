import type { PrismaClient } from '@leanmgmt/prisma-client';
import { verifyAuditLogChain } from '@leanmgmt/shared-utils';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * API `AuditLogsService.runVerificationAndStore` ile aynı sonuç satırı; gecelik/periodik job.
 * Zincir onarımı yok (ADR-0026).
 */
export async function runAuditChainVerification(prisma: PrismaClient): Promise<{
  chainIntact: boolean;
  totalRecordsChecked: number;
  durationMs: number;
}> {
  const started = Date.now();
  const all = await prisma.auditLog.findMany();
  const chain = verifyAuditLogChain(all);
  const duration = Date.now() - started;
  if (chain.chainIntact) {
    await prisma.auditChainIntegrityCheck.create({
      data: {
        chainIntact: true,
        firstBrokenAt: null,
        firstBrokenRecordId: null,
        totalRecordsChecked: all.length,
        durationMs: duration,
      },
    });
    return { chainIntact: true, totalRecordsChecked: all.length, durationMs: duration };
  }
  const firstBrokenRow = all.find((r) => r.id === chain.firstBrokenRecordId);
  await prisma.auditChainIntegrityCheck.create({
    data: {
      chainIntact: false,
      firstBrokenAt: firstBrokenRow?.timestamp ?? new Date(chain.firstBrokenAt),
      firstBrokenRecordId: chain.firstBrokenRecordId,
      totalRecordsChecked: all.length,
      durationMs: duration,
    },
  });
  console.error(
    JSON.stringify({
      event: 'audit_chain_broken',
      at: chain.firstBrokenAt,
      recordId: chain.firstBrokenRecordId,
    }),
  );
  return { chainIntact: false, totalRecordsChecked: all.length, durationMs: duration };
}

/**
 * Varsayılan 24 saat; test için `AUDIT_CHAIN_CRON_INTERVAL_MS` kısaltılabilir.
 */
export function startAuditChainVerify(prisma: PrismaClient): () => Promise<void> {
  const intervalMs = Number(process.env.AUDIT_CHAIN_CRON_INTERVAL_MS ?? DAY_MS);
  const safeMs = Number.isFinite(intervalMs) && intervalMs >= 60_000 ? intervalMs : DAY_MS;

  const tick = (): void => {
    void runAuditChainVerification(prisma).then((r) => {
      console.log(JSON.stringify({ event: 'audit_chain_verify_cron', ...r }));
    });
  };

  tick();
  const id = setInterval(tick, safeMs);
  return async () => {
    clearInterval(id);
  };
}
