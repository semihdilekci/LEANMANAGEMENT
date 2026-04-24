'use client';

import type { MasterDataType } from '@leanmgmt/shared-schemas';

import { MasterDataForm } from '@/components/master-data/MasterDataForm';
import { useMasterDataDetailQuery } from '@/lib/queries/master-data';

interface MasterDataEditContentProps {
  type: MasterDataType;
  id: string;
}

export function MasterDataEditContent({ type, id }: MasterDataEditContentProps) {
  const { data: item, isLoading, error } = useMasterDataDetailQuery(type, id);

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy className="space-y-[var(--space-4)]">
        <span className="sr-only">Yükleniyor...</span>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
    );
  }

  if (error || !item) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        Kayıt bilgileri yüklenemedi.
      </div>
    );
  }

  return <MasterDataForm mode="edit" type={type} itemId={id} defaultValues={item} />;
}
