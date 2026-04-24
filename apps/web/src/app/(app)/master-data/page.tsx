import type { Metadata } from 'next';
import Link from 'next/link';

import { MASTER_DATA_TYPES } from '@leanmgmt/shared-schemas';

import { MASTER_DATA_TYPE_LABELS } from '@/lib/queries/master-data';

export const metadata: Metadata = {
  title: 'Master Data',
};

export default function MasterDataIndexPage() {
  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
          Master Data
        </h1>
        <p className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-500)]">
          Sistemde kullanılan referans verilerini yönetin.
        </p>
      </div>

      <div className="grid gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
        {MASTER_DATA_TYPES.map((type) => (
          <Link
            key={type}
            href={`/master-data/${type}`}
            className="ls-card block p-[var(--space-5)] transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:outline-none"
          >
            <h2 className="font-semibold text-[var(--color-neutral-800)]">
              {MASTER_DATA_TYPE_LABELS[type]}
            </h2>
            <p className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-500)]">{type}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
