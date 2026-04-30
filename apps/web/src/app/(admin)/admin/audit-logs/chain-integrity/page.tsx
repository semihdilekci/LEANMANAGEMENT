import Link from 'next/link';

import { Permission } from '@leanmgmt/shared-types';

import { AuditChainIntegrityPanel } from '@/components/admin/AuditChainIntegrityPanel';
import { PermissionGate } from '@/components/shared/PermissionGate';

export default function AdminAuditChainIntegrityPage() {
  return (
    <PermissionGate
      permission={Permission.AUDIT_LOG_VIEW}
      fallback={
        <p className="text-sm text-[var(--color-neutral-600)]">Bu sayfaya erişim yetkiniz yok.</p>
      }
    >
      <div className="space-y-[var(--space-6)]">
        <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
          <h1 className="text-xl font-semibold text-[var(--color-neutral-900)]">
            Denetim zinciri bütünlüğü
          </h1>
          <Link
            href="/admin/audit-logs"
            className="text-sm text-[var(--color-primary-600)] underline underline-offset-2"
          >
            Denetim listesi
          </Link>
        </div>
        <AuditChainIntegrityPanel showDetailLink={false} />
      </div>
    </PermissionGate>
  );
}
