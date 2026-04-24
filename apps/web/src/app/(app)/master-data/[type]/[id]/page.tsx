import type { Metadata } from 'next';
import Link from 'next/link';

import { MASTER_DATA_TYPES } from '@leanmgmt/shared-schemas';
import type { MasterDataType } from '@leanmgmt/shared-schemas';

import { MASTER_DATA_TYPE_LABELS } from '@/lib/queries/master-data';
import { MasterDataDetailContent } from './MasterDataDetailContent';

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type } = await params;
  const label = MASTER_DATA_TYPE_LABELS[type as MasterDataType] ?? type;
  return { title: `${label} Detayı` };
}

export default async function MasterDataDetailPage({ params }: PageProps) {
  const { type, id } = await params;

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
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-[var(--space-2)] text-sm text-[var(--color-neutral-500)]">
          <li>
            <Link href="/master-data" className="hover:text-[var(--color-primary-600)]">
              Master Data
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/master-data/${type}`} className="hover:text-[var(--color-primary-600)]">
              {typeName}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--color-neutral-800)]">Detay</li>
        </ol>
      </nav>

      <MasterDataDetailContent type={type as MasterDataType} id={id} />
    </div>
  );
}
