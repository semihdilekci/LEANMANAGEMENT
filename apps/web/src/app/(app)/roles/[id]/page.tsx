import type { Metadata } from 'next';

import { RoleDetailContent } from '@/components/roles/RoleDetailContent';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Rol ${id.slice(0, 8)}…` };
}

export default async function RoleDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <RoleDetailContent roleId={id} />;
}
