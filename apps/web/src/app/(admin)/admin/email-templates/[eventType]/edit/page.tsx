'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Permission } from '@leanmgmt/shared-types';

import { EmailTemplateEditor } from '@/components/admin/EmailTemplateEditor';
import { PermissionGate } from '@/components/shared/PermissionGate';

export default function AdminEmailTemplateEditPage() {
  const params = useParams();
  const raw = params.eventType;
  const eventType = typeof raw === 'string' ? decodeURIComponent(raw) : '';

  return (
    <PermissionGate
      permission={Permission.EMAIL_TEMPLATE_EDIT}
      fallback={
        <div className="ls-card p-[var(--space-6)] shadow-[var(--shadow-md)]">
          <p className="text-[var(--color-neutral-700)]">
            Bu şablonu düzenlemek için yetkiniz yok.
          </p>
          <Link
            href="/admin/email-templates"
            className="mt-3 inline-block text-sm text-[var(--color-primary-600)] underline"
          >
            Listeye dön
          </Link>
        </div>
      }
    >
      <EmailTemplateEditor eventType={eventType} />
    </PermissionGate>
  );
}
