import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  NotificationListQuery,
  NotificationPreferencesPutInput,
} from '@leanmgmt/shared-schemas';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export interface NotificationItem {
  id: string;
  eventType: string;
  channel: string;
  title: string;
  body: string;
  linkUrl: string | null;
  metadata: unknown;
  readAt: string | null;
  sentAt: string;
  deliveryStatus: string;
}

export interface NotificationListPage {
  items: NotificationItem[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
    total: number;
  };
}

export interface NotificationPreferenceRow {
  eventType: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  digestEnabled: boolean;
}

const NOTIF_STALE = 30_000;
const NOTIF_REFETCH = 30_000;

export function useNotificationsInfiniteQuery(
  baseFilters: Omit<NotificationListQuery, 'cursor'>,
  enabled = true,
) {
  const listKey = { ...baseFilters } as Omit<NotificationListQuery, 'cursor'>;
  return useInfiniteQuery({
    queryKey: queryKeys.notifications.listInfinite(listKey),
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<{ success: boolean; data: NotificationListPage }>(
        '/api/v1/notifications',
        {
          params: {
            ...baseFilters,
            ...(pageParam ? { cursor: pageParam as string } : {}),
          },
        },
      );
      return res.data.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.pagination.hasMore && last.pagination.nextCursor
        ? last.pagination.nextCursor
        : undefined,
    staleTime: NOTIF_STALE,
    refetchInterval: NOTIF_REFETCH,
    enabled,
  });
}

export function useUnreadNotificationCountQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: { inAppUnreadCount: number };
      }>('/api/v1/notifications/unread-count');
      return res.data.data.inAppUnreadCount;
    },
    staleTime: NOTIF_STALE,
    refetchInterval: NOTIF_REFETCH,
    enabled,
  });
}

export function useRecentNotificationsQuery(limit = 5, enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications.list({
      channel: 'IN_APP',
      isRead: 'all',
      limit,
    } as NotificationListQuery),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: NotificationListPage }>(
        '/api/v1/notifications',
        {
          params: {
            channel: 'IN_APP',
            isRead: 'all',
            limit,
          },
        },
      );
      return res.data.data.items;
    },
    staleTime: NOTIF_STALE,
    refetchInterval: NOTIF_REFETCH,
    enabled,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/api/v1/notifications/${encodeURIComponent(id)}/mark-read`, {});
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ success: boolean; data: { markedCount: number } }>(
        '/api/v1/notifications/mark-all-read',
        {},
      );
      return res.data.data;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

export function useNotificationPreferencesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notificationPreferences.me(),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: { preferences: NotificationPreferenceRow[] };
      }>('/api/v1/notification-preferences');
      return res.data.data.preferences;
    },
    staleTime: 60_000,
    enabled,
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: NotificationPreferencesPutInput) => {
      await apiClient.put('/api/v1/notification-preferences', body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences.all() });
    },
  });
}
