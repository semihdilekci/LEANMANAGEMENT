'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Bell } from 'lucide-react';

import {
  useMarkNotificationReadMutation,
  useRecentNotificationsQuery,
  useUnreadNotificationCountQuery,
} from '@/lib/queries/notifications';

import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnId = useId();
  const menuId = useId();
  const { data: unread = 0 } = useUnreadNotificationCountQuery();
  const { data: recent = [], isLoading } = useRecentNotificationsQuery(5);
  const markRead = useMarkNotificationReadMutation();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        id={btnId}
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-500)]"
        aria-label="Bildirimler"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--color-danger-600)] px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      <span className="sr-only" role="status">
        {isLoading ? 'Bildirimler yükleniyor' : `${unread} okunmamış`}
      </span>
      {open ? (
        <div id={menuId} role="region" aria-labelledby={btnId}>
          <NotificationDropdown items={recent} markRead={markRead} onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
