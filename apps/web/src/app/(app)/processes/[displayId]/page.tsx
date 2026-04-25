import type { Metadata } from 'next';
import Link from 'next/link';

import { ProcessDetail } from '@/components/processes/ProcessDetail';

interface PageProps {
  params: Promise<{ displayId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { displayId } = await params;
  return { title: `Süreç ${displayId}` };
}

export default async function ProcessDetailPage({ params }: PageProps) {
  const { displayId } = await params;
  return (
    <div className="space-y-[var(--space-6)]">
      <ProcessDetail displayId={displayId} />
      <p className="text-center text-sm text-[var(--color-neutral-500)]">
        <Link href="/processes" className="text-[var(--color-primary-600)] hover:underline">
          Süreç listesine dön
        </Link>
      </p>
    </div>
  );
}
