import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AuditLogExportQuery, AuditLogListQuery } from '@leanmgmt/shared-schemas';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export type AuditLogListEnvelope = {
  data: AuditLogRow[];
  pagination: { nextCursor: string | null; hasMore: boolean };
};

export type AuditLogRow = {
  id: string;
  timestamp: string;
  userId: string | null;
  user: { sicil: string | null; firstName: string; lastName: string } | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  metadata: unknown;
  ipHash: string;
  userAgent: string | null;
  sessionId: string | null;
  chainHash: string;
};

export type AuditChainIntegrityView = {
  lastCheckAt: string | null;
  totalRecordsChecked: number;
  chainIntact: boolean;
  firstBrokenAt: string | null;
  firstBrokenRecordId: string | null;
  nextScheduledCheckAt: string;
};

export function useAuditLogsInfiniteQuery(filters: AuditLogListQuery, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.auditLogs.list(filters),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const res = await apiClient.get<{ success: boolean; data: AuditLogListEnvelope }>(
        '/api/v1/admin/audit-logs',
        {
          params: { ...filters, cursor: pageParam },
        },
      );
      return res.data.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.pagination.hasMore && last.pagination.nextCursor
        ? last.pagination.nextCursor
        : undefined,
    staleTime: 0,
    enabled,
  });
}

export function useAuditChainIntegrityQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.auditChainIntegrity.summary(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: AuditChainIntegrityView }>(
        '/api/v1/admin/audit-logs/chain-integrity',
      );
      return res.data.data;
    },
    staleTime: 60_000,
    enabled,
  });
}

export function useVerifyAuditChainMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ success: boolean; data: AuditChainIntegrityView }>(
        '/api/v1/admin/audit-logs/chain-integrity/verify',
        {},
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.auditChainIntegrity.all() });
    },
  });
}

export async function downloadAuditLogsCsv(params: AuditLogExportQuery): Promise<void> {
  const res = await apiClient.get<Blob>('/api/v1/admin/audit-logs/export', {
    params,
    responseType: 'blob',
  });
  const blob = res.data;
  const ct = String(res.headers['content-type'] ?? '');
  if (ct.includes('application/json')) {
    const text = await blob.text();
    let message = 'Dışa aktarma başarısız';
    try {
      const j = JSON.parse(text) as { error?: { message?: string } };
      if (j?.error?.message) message = j.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'audit-logs.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}
