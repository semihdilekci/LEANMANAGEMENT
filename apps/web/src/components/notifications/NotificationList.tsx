'use client';

import type { UseMutationResult } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { NOTIFICATION_EVENT_TYPES } from '@leanmgmt/shared-schemas';
import type { NotificationListQuery } from '@leanmgmt/shared-schemas';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  formatNotificationRelativeTime,
  notificationEventIcon,
  notificationEventLabel,
} from '@/lib/notification-ui';
import type { NotificationItem } from '@/lib/queries/notifications';
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsInfiniteQuery,
} from '@/lib/queries/notifications';

function isReadParam(v: string | null): NotificationListQuery['isRead'] {
  if (v === 'true' || v === 'false' || v === 'all') return v;
  return 'false';
}

function ListRow({
  item,
  markRead,
}: {
  item: NotificationItem;
  markRead: UseMutationResult<void, Error, string, unknown>;
}) {
  const router = useRouter();
  const Icon = notificationEventIcon(item.eventType);
  const unread = item.readAt === null;

  const go = () => {
    if (unread) {
      void markRead.mutateAsync(item.id).catch(() => {});
    }
    if (item.linkUrl) router.push(item.linkUrl);
  };

  return (
    <li
      role="listitem"
      className="group flex border-b border-[var(--color-neutral-100)] last:border-b-0"
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-4)] text-left hover:bg-[var(--color-neutral-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-500)]"
        onClick={() => go()}
        aria-label={`${item.title}${unread ? ' — okunmamış bildirim' : ''}`}
      >
        <span className="mt-1 shrink-0" aria-hidden>
          {unread ? (
            <span className="block h-2 w-2 rounded-full bg-[var(--color-primary-500)]" />
          ) : (
            <span className="block h-2 w-2 rounded-full border border-[var(--color-neutral-300)]" />
          )}
        </span>
        <span className="shrink-0 pt-0.5" aria-hidden>
          <Icon
            className={`h-5 w-5 ${item.eventType === 'SLA_BREACH' ? 'text-[var(--color-danger-600)]' : 'text-[var(--color-neutral-500)]'}`}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium text-[var(--color-neutral-900)]">{item.title}</span>
          <span className="mt-0.5 block truncate text-sm text-[var(--color-neutral-600)]">
            {item.body}
          </span>
          <span className="mt-1 text-xs text-[var(--color-neutral-500)]">
            {formatNotificationRelativeTime(item.sentAt)}
          </span>
        </span>
        <span className="hidden shrink-0 self-center rounded border border-[var(--color-neutral-200)] px-2 py-0.5 text-xs text-[var(--color-neutral-600)] sm:inline">
          {notificationEventLabel(item.eventType)}
        </span>
      </button>
      {unread ? (
        <div className="flex items-center pr-[var(--space-2)]">
          <button
            type="button"
            className="ls-btn ls-btn--neutral ls-btn--sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              void markRead.mutateAsync(item.id).catch(() => {});
            }}
          >
            Okundu
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function NotificationList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  const isRead = isReadParam(searchParams.get('isRead'));
  const rawEvent = searchParams.get('eventType');
  const eventType =
    rawEvent && (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(rawEvent)
      ? rawEvent
      : undefined;

  const baseFilters = useMemo(
    () =>
      ({
        channel: 'IN_APP',
        isRead,
        eventType: eventType as NotificationListQuery['eventType'],
        limit: 20,
      }) satisfies Omit<NotificationListQuery, 'cursor'>,
    [isRead, eventType],
  );

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotificationsInfiniteQuery(baseFilters);

  const markRead = useMarkNotificationReadMutation();
  const markAll = useMarkAllNotificationsReadMutation();

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data?.pages]);

  const unreadOnPage = items.some((i) => i.readAt === null);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const p = new URLSearchParams(searchParams.toString());
      if (value === null || value === '') p.delete(key);
      else p.set(key, value);
      p.delete('cursor');
      router.push(`/notifications?${p.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="ls-card overflow-hidden shadow-[var(--shadow-md)]">
      <div className="flex flex-col gap-[var(--space-4)] border-b border-[var(--color-neutral-200)] p-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-neutral-900)]">
            Bildirimler
          </h1>
          <p className="text-sm text-[var(--color-neutral-600)]">
            In-app bildirimleriniz; e-posta ayrı kanaldadır.
          </p>
        </div>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm shrink-0 self-start disabled:opacity-50"
          disabled={!unreadOnPage || markAll.isPending}
          onClick={() => setConfirmAllOpen(true)}
        >
          Tümünü okundu işaretle
        </button>
      </div>

      <div className="flex flex-col gap-[var(--space-3)] border-b border-[var(--color-neutral-100)] p-[var(--space-4)] sm:flex-row sm:flex-wrap">
        <div className="flex gap-2" role="tablist" aria-label="Okunma durumu">
          <button
            type="button"
            className={`ls-btn ls-btn--sm ${isRead === 'false' ? 'ls-btn--primary' : 'ls-btn--neutral'}`}
            onClick={() => setParam('isRead', 'false')}
          >
            Okunmamış
          </button>
          <button
            type="button"
            className={`ls-btn ls-btn--sm ${isRead === 'all' ? 'ls-btn--primary' : 'ls-btn--neutral'}`}
            onClick={() => setParam('isRead', 'all')}
          >
            Tümü
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-700)]">
          <span className="shrink-0">Olay tipi</span>
          <select
            className="ls-input min-w-[12rem] py-1.5 text-sm"
            value={eventType ?? ''}
            onChange={(e) => setParam('eventType', e.target.value || null)}
            aria-label="Olay tipi filtresi"
          >
            <option value="">Tümü</option>
            {NOTIFICATION_EVENT_TYPES.map((et) => (
              <option key={et} value={et}>
                {notificationEventLabel(et)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="p-[var(--space-4)]" role="status">
          <span className="sr-only">Yükleniyor</span>
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-16 animate-pulse rounded bg-[var(--color-neutral-100)]" />
            ))}
          </ul>
        </div>
      ) : null}

      {isError ? (
        <div className="p-[var(--space-6)] text-center">
          <p className="text-sm text-[var(--color-danger-600)]">Bildirimler yüklenemedi.</p>
          <button
            type="button"
            className="ls-btn ls-btn--neutral ls-btn--sm mt-2"
            onClick={() => refetch()}
          >
            Tekrar dene
          </button>
        </div>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <div className="p-[var(--space-10)] text-center">
          <p className="text-[var(--color-neutral-600)]">
            {isRead === 'false' ? 'Okunmamış bildiriminiz yok.' : 'Henüz bildiriminiz yok.'}
          </p>
          {isRead === 'false' ? (
            <Link
              href="/notifications?isRead=all"
              className="mt-3 inline-block text-sm text-[var(--color-primary-600)] underline"
            >
              Tümünü gör
            </Link>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !isError && items.length > 0 ? (
        <>
          <ul className="divide-y divide-[var(--color-neutral-100)]" role="list">
            {items.map((n) => (
              <ListRow key={n.id} item={n} markRead={markRead} />
            ))}
          </ul>
          {hasNextPage ? (
            <div className="border-t border-[var(--color-neutral-100)] p-[var(--space-4)] text-center">
              <button
                type="button"
                className="ls-btn ls-btn--neutral ls-btn--sm"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                {isFetchingNextPage ? 'Yükleniyor…' : 'Daha fazla yükle'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={confirmAllOpen}
        onOpenChange={setConfirmAllOpen}
        title="Tümünü okundu işaretle"
        description="Tüm okunmamış in-app bildirimler okundu olarak işaretlensin mi?"
        confirmLabel="Evet, işaretle"
        destructive={false}
        onConfirm={async () => {
          await markAll.mutateAsync();
          setConfirmAllOpen(false);
        }}
      />
    </div>
  );
}
