import type { Metadata } from 'next';
import Link from 'next/link';

import { MASTER_DATA_TYPES } from '@leanmgmt/shared-schemas';
import type { MasterDataType } from '@leanmgmt/shared-schemas';

import { MASTER_DATA_TYPE_LABELS } from '@/lib/queries/master-data';
import { MasterDataForm } from '@/components/master-data/MasterDataForm';

interface PageProps {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type } = await params;
  const label = MASTER_DATA_TYPE_LABELS[type as MasterDataType] ?? type;
  return { title: `Yeni ${label}` };
}

export default async function NewMasterDataPage({ params }: PageProps) {
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
          <li className="text-[var(--color-neutral-800)]">Yeni Kayıt</li>
        </ol>
      </nav>

      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
        Yeni {typeName} Oluştur
      </h1>

      <div className="ls-card p-[var(--space-6)]">
        <MasterDataForm mode="create" type={type as MasterDataType} />
      </div>
    </div>
  );
}
