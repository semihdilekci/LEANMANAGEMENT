import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { ProcessList } from '@/components/processes/ProcessList';

export const metadata: Metadata = {
  title: 'Süreçler',
};

export default function ProcessesPage() {
  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
          Süreçler
        </h1>
        <p className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-500)]">
          Başlattığınız süreçleri görüntüleyin; yetkiniz varsa tüm organizasyon süreçlerine erişin.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-[var(--space-3)]" role="status" aria-live="polite">
            <span className="sr-only">Yükleniyor...</span>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
              />
            ))}
          </div>
        }
      >
        <ProcessList />
      </Suspense>

      <p className="text-center text-sm text-[var(--color-neutral-500)]">
        <Link href="/dashboard" className="text-[var(--color-primary-600)] hover:underline">
          Ana sayfaya dön
        </Link>
      </p>
    </div>
  );
}
