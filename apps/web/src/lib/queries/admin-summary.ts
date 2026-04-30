import { useQuery } from '@tanstack/react-query';
import type { AdminOrganizationSummary } from '@leanmgmt/shared-schemas';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useAdminOrganizationSummaryQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.summary(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: AdminOrganizationSummary }>(
        '/api/v1/admin/summary',
      );
      return res.data.data;
    },
    staleTime: 60_000,
    enabled,
  });
}
