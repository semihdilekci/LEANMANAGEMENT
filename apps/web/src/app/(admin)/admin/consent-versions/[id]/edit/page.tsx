import { Permission } from '@leanmgmt/shared-types';

import { ConsentVersionEditPageClient } from '@/components/admin/ConsentVersionEditPageClient';
import { PermissionGate } from '@/components/shared/PermissionGate';

export default function AdminConsentVersionEditPage() {
  return (
    <PermissionGate
      permission={Permission.CONSENT_VERSION_VIEW}
      fallback={
        <p className="text-sm text-[var(--color-neutral-600)]">Bu sayfaya erişim yetkiniz yok.</p>
      }
    >
      <ConsentVersionEditPageClient />
    </PermissionGate>
  );
}
