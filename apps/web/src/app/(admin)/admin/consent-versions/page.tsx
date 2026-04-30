import { Permission } from '@leanmgmt/shared-types';

import { ConsentVersionsPageClient } from '@/components/admin/ConsentVersionsPageClient';
import { PermissionGate } from '@/components/shared/PermissionGate';

export default function AdminConsentVersionsPage() {
  return (
    <PermissionGate
      permission={Permission.CONSENT_VERSION_VIEW}
      fallback={
        <p className="text-sm text-[var(--color-neutral-600)]">Bu sayfaya erişim yetkiniz yok.</p>
      }
    >
      <ConsentVersionsPageClient />
    </PermissionGate>
  );
}
