import { Permission } from '@leanmgmt/shared-types';

import { ConsentVersionNewPageClient } from '@/components/admin/ConsentVersionNewPageClient';
import { PermissionGate } from '@/components/shared/PermissionGate';

export default function AdminConsentVersionNewPage() {
  return (
    <PermissionGate
      permission={Permission.CONSENT_VERSION_EDIT}
      fallback={
        <p className="text-sm text-[var(--color-neutral-600)]">Bu sayfaya erişim yetkiniz yok.</p>
      }
    >
      <ConsentVersionNewPageClient />
    </PermissionGate>
  );
}
