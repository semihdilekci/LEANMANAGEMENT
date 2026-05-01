'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type { AuthMeResponse } from '@/types/auth-me';

export function useAuthMeQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      const r = await apiClient.get<{ success: boolean; data: AuthMeResponse }>('/api/v1/auth/me');
      if (!r.data.success || !r.data.data) throw new Error('Profil verisi alınamadı');
      return r.data.data;
    },
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateAvatarMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (avatarKey: string) => {
      const r = await apiClient.patch<{ success: boolean; data: { avatarKey: string } }>(
        '/api/v1/auth/me/avatar',
        { avatarKey },
      );
      if (!r.data.success || !r.data.data) throw new Error('Avatar güncellenemedi');
      return r.data.data;
    },
    onSuccess: (data) => {
      const cur = useAuthStore.getState().currentUser;
      if (cur) {
        useAuthStore.setState({ currentUser: { ...cur, avatarKey: data.avatarKey } });
      }
      void qc.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}
