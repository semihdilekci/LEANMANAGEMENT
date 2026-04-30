'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { UseMutationResult } from '@tanstack/react-query';

import { formatNotificationRelativeTime, notificationEventIcon } from '@/lib/notification-ui';
import type { NotificationItem } from '@/lib/queries/notifications';

function NotificationRow({
  item,
  onNavigate,
  markRead,
}: {
  item: NotificationItem;
  onNavigate: () => void;
  markRead: UseMutationResult<void, Error, string, unknown>;
}) {
  const router = useRouter();
  const Icon = notificationEventIcon(item.eventType);
  const unread = item.readAt === null;

  const handleActivate = () => {
    if (unread) {
      void markRead.mutateAsync(item.id).catch(() => {});
    }
    if (item.linkUrl) {
      onNavigate();
      router.push(item.linkUrl);
    }
  };

  return (
    <li role="listitem">
      <button
        type="button"
        className="flex w-full gap-[var(--space-3)] border-b border-[var(--color-neutral-100)] px-[var(--space-3)] py-[var(--space-3)] text-left hover:bg-[var(--color-neutral-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-500)]"
        onClick={() => handleActivate()}
        aria-label={`${item.title}${unread ? ' — okunmamış bildirim' : ''}`}
      >
        <span className="mt-0.5 shrink-0" aria-hidden>
          <Icon
            className={`h-4 w-4 ${item.eventType === 'SLA_BREACH' ? 'text-[var(--color-danger-600)]' : 'text-[var(--color-neutral-500)]'}`}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[var(--color-neutral-900)]">
            {item.title}
          </span>
          <span className="line-clamp-2 text-xs text-[var(--color-neutral-600)]">{item.body}</span>
          <span className="mt-1 block text-xs text-[var(--color-neutral-500)]">
            {formatNotificationRelativeTime(item.sentAt)}
          </span>
        </span>
        {unread ? (
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary-500)]"
            aria-hidden
          />
        ) : (
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-[var(--color-neutral-300)] bg-transparent"
            aria-hidden
          />
        )}
      </button>
    </li>
  );
}

export function NotificationDropdown({
  items,
  onClose,
  markRead,
}: {
  items: NotificationItem[];
  onClose: () => void;
  markRead: UseMutationResult<void, Error, string, unknown>;
}) {
  return (
    <div
      className="absolute right-0 z-50 mt-[var(--space-2)] w-[min(100vw-2rem,22rem)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] shadow-[var(--shadow-md)]"
      role="presentation"
    >
      <div className="border-b border-[var(--color-neutral-100)] px-[var(--space-3)] py-[var(--space-2)]">
        <p className="text-sm font-semibold text-[var(--color-neutral-900)]">Bildirimler</p>
      </div>
      {items.length === 0 ? (
        <p className="px-[var(--space-4)] py-[var(--space-6)] text-center text-sm text-[var(--color-neutral-600)]">
          Henüz bildiriminiz yok
        </p>
      ) : (
        <ul className="max-h-80 overflow-y-auto" role="list">
          {items.map((n) => (
            <NotificationRow key={n.id} item={n} onNavigate={onClose} markRead={markRead} />
          ))}
        </ul>
      )}
      <div className="border-t border-[var(--color-neutral-100)] p-[var(--space-2)]">
        <Link
          href="/notifications"
          className="ls-btn ls-btn--neutral ls-btn--sm block w-full text-center no-underline"
          onClick={onClose}
        >
          Tümünü gör
        </Link>
      </div>
    </div>
  );
}
