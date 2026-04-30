import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { SystemSettingKey } from '@leanmgmt/shared-schemas';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export type SystemSettingRow = {
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
  updatedByUserId: string | null;
};

export function useSystemSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.systemSettings.all(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: SystemSettingRow[] }>(
        '/api/v1/admin/system-settings',
      );
      return res.data.data;
    },
    staleTime: 30_000,
    enabled,
  });
}

export function useUpdateSystemSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: SystemSettingKey; value: unknown }) => {
      const res = await apiClient.put<{ success: boolean; data: SystemSettingRow }>(
        `/api/v1/admin/system-settings/${encodeURIComponent(key)}`,
        { value },
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.systemSettings.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.consentVersions.all() });
    },
  });
}
