import type { Metadata } from 'next';
import Link from 'next/link';

import { Permission } from '@leanmgmt/shared-types';

import { KtiStartForm } from '@/components/processes/KtiStartForm';
import { PermissionGate } from '@/components/shared/PermissionGate';

export const metadata: Metadata = {
  title: 'Yeni KTİ',
};

export default function KtiStartPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-[var(--space-6)]">
      <nav className="text-sm text-[var(--color-neutral-500)]" aria-label="Breadcrumb">
        <Link href="/processes" className="hover:text-[var(--color-primary-600)]">
          Süreçler
        </Link>
        <span className="mx-[var(--space-2)]">›</span>
        <span className="text-[var(--color-neutral-800)]">Yeni KTİ</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-neutral-900)]">
          Yeni KTİ (Before & After Kaizen) Başlat
        </h1>
        <p className="mt-[var(--space-2)] text-sm text-[var(--color-neutral-600)]">
          Bu form ile Kaizen Tamamlama İyileştirme süreci başlatılır. Başlatma sonrası süreç
          yöneticinize onaya düşer.
        </p>
      </div>

      <section
        className="rounded-[var(--radius-md)] border border-[var(--color-primary-200)] bg-[var(--color-primary-a14)] p-[var(--space-4)] text-sm text-[var(--color-neutral-800)]"
        aria-labelledby="kti-info-heading"
      >
        <h2 id="kti-info-heading" className="sr-only">
          Bilgilendirme
        </h2>
        <p>Yöneticinizin onaylaması için 72 saat SLA tanımlıdır.</p>
        <p className="mt-[var(--space-2)]">
          Tüm fotoğraflar virüs taramasından geçtikten sonra süreç başlatılabilir.
        </p>
      </section>

      <PermissionGate
        permission={Permission.PROCESS_KTI_START}
        fallback={
          <div className="ls-alert ls-alert--danger" role="alert">
            <p>Bu sayfayı görüntülemek için KTİ başlatma yetkisi gerekir.</p>
            <Link href="/processes" className="mt-[var(--space-2)] inline-block text-sm underline">
              Süreçlere dön
            </Link>
          </div>
        }
      >
        <KtiStartForm />
      </PermissionGate>
    </div>
  );
}
