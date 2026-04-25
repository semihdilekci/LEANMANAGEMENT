import type { Metadata } from 'next';

import { TaskList } from '@/components/tasks/TaskList';

export const metadata: Metadata = {
  title: 'Görevlerim',
};

export default function TasksPage() {
  return (
    <div className="space-y-[var(--space-6)]">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
        Görevlerim
      </h1>
      <TaskList />
    </div>
  );
}
