import type { Metadata } from 'next';

import { TaskDetail } from '@/components/tasks/TaskDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Görev ${id.slice(0, 8)}…` };
}

export default async function TaskDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <TaskDetail taskId={id} />;
}
