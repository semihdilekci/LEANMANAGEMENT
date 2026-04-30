'use client';

import { Suspense } from 'react';

import { NotificationList } from '@/components/notifications/NotificationList';

function NotificationListFallback() {
  return (
    <div className="ls-card p-[var(--space-8)] shadow-[var(--shadow-md)]" role="status">
      <p className="text-[var(--color-neutral-600)]">Yükleniyor…</p>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationListFallback />}>
      <NotificationList />
    </Suspense>
  );
}
