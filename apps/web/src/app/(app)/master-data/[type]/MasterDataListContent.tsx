'use client';

import type { MasterDataType } from '@leanmgmt/shared-schemas';

import { MasterDataTable } from '@/components/master-data/MasterDataTable';

interface MasterDataListContentProps {
  type: MasterDataType;
}

export function MasterDataListContent({ type }: MasterDataListContentProps) {
  return <MasterDataTable type={type} />;
}
