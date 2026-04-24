import type { Metadata } from 'next';
import Link from 'next/link';

import { MASTER_DATA_TYPES } from '@leanmgmt/shared-schemas';
import type { MasterDataType } from '@leanmgmt/shared-schemas';

import { MASTER_DATA_TYPE_LABELS } from '@/lib/queries/master-data';
import { MasterDataListContent } from './MasterDataListContent';

interface PageProps {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type } = await params;
  const label = MASTER_DATA_TYPE_LABELS[type as MasterDataType] ?? type;
  return { title: label };
}

export default async function MasterDataListPage({ params }: PageProps) {
  const { type } = await params;

  if (!MASTER_DATA_TYPES.includes(type as MasterDataType)) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        Geçersiz master data tipi: {type}
      </div>
    );
  }

  const typeName = MASTER_DATA_TYPE_LABELS[type as MasterDataType] ?? type;

  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex items-center justify-between">
        <div>
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-[var(--space-2)] text-sm text-[var(--color-neutral-500)]">
              <li>
                <Link href="/master-data" className="hover:text-[var(--color-primary-600)]">
                  Master Data
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-[var(--color-neutral-800)]">{typeName}</li>
            </ol>
          </nav>
          <h1 className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
            {typeName}
          </h1>
        </div>
        <Link href={`/master-data/${type}/new`} className="ls-btn ls-btn--primary">
          + Yeni Kayıt
        </Link>
      </div>

      <MasterDataListContent type={type as MasterDataType} />
    </div>
  );
}
