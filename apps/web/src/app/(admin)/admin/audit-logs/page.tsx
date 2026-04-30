import { Suspense } from 'react';

import { Permission } from '@leanmgmt/shared-types';

import { AuditLogsPageClient } from '@/components/admin/AuditLogsPageClient';
import { PermissionGate } from '@/components/shared/PermissionGate';

export default function AdminAuditLogsPage() {
  return (
    <PermissionGate
      permission={Permission.AUDIT_LOG_VIEW}
      fallback={
        <p className="text-sm text-[var(--color-neutral-600)]">Bu sayfaya erişim yetkiniz yok.</p>
      }
    >
      <Suspense fallback={<p className="text-sm text-[var(--color-neutral-600)]">Yükleniyor…</p>}>
        <AuditLogsPageClient />
      </Suspense>
    </PermissionGate>
  );
}
