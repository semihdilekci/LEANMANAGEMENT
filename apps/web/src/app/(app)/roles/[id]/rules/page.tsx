import type { Metadata } from 'next';

import { AttributeRuleBuilder } from '@/components/roles/AttributeRuleBuilder';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Rol Kuralları' };
}

export default async function RoleRulesPage({ params }: PageProps) {
  const { id } = await params;
  return <AttributeRuleBuilder roleId={id} />;
}
