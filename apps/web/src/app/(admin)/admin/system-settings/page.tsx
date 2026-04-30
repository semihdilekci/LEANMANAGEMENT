import { Permission } from '@leanmgmt/shared-types';

import { SystemSettingsPageClient } from '@/components/admin/SystemSettingsPageClient';
import { PermissionGate } from '@/components/shared/PermissionGate';

export default function AdminSystemSettingsPage() {
  return (
    <PermissionGate
      anyOf={[Permission.SYSTEM_SETTINGS_VIEW, Permission.SYSTEM_SETTINGS_EDIT]}
      fallback={
        <p className="text-sm text-[var(--color-neutral-600)]">Bu sayfaya erişim yetkiniz yok.</p>
      }
    >
      <SystemSettingsPageClient />
    </PermissionGate>
  );
}
