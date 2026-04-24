import type { Metadata } from 'next';

import { PermissionMatrix } from '@/components/roles/PermissionMatrix';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Rol Yetkileri' };
}

export default async function RolePermissionsPage({ params }: PageProps) {
  const { id } = await params;
  return <PermissionMatrix roleId={id} />;
}
