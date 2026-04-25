import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { KtiStartInput } from '@leanmgmt/shared-schemas';

import { apiClient } from '@/lib/api-client';
import { queryKeys, type ProcessListFilters } from '@/lib/query-keys';

export interface ProcessStartedBy {
  id: string;
  sicil: string | null;
  firstName: string;
  lastName: string;
}

export interface ProcessCompany {
  id: string;
  code: string;
  name: string;
}

export interface ProcessListItem {
  id: string;
  displayId: string;
  processType: string;
  status: string;
  startedBy: ProcessStartedBy;
  company: ProcessCompany;
  activeTaskLabel: string;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface ProcessTaskItem {
  id: string;
  stepKey: string;
  stepOrder: number;
  status: string;
  completedAt: string | null;
  completionAction: string | null;
  completedBy?: ProcessStartedBy;
  assignedTo?: ProcessStartedBy;
  slaDueAt?: string;
  formData?: unknown;
}

export interface ProcessDocumentItem {
  id: string;
  filename: string;
  scanStatus: string;
  thumbnailUrl: string | null;
}

export interface ProcessDetail {
  id: string;
  displayId: string;
  processType: string;
  status: string;
  activeTaskLabel: string;
  startedBy: ProcessStartedBy;
  company: ProcessCompany;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  tasks: ProcessTaskItem[];
  documents: ProcessDocumentItem[];
}

export function useProcessesListQuery(filters: ProcessListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.processes.list(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: {
          items: ProcessListItem[];
          pagination: { nextCursor: string | null; hasMore: boolean };
        };
      }>('/api/v1/processes', { params: filters });
      return res.data.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  });
}

export function useProcessDetailQuery(displayId: string) {
  return useQuery({
    queryKey: queryKeys.processes.detail(displayId),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ProcessDetail }>(
        `/api/v1/processes/${encodeURIComponent(displayId)}`,
      );
      return res.data.data;
    },
    enabled: !!displayId,
    staleTime: 10_000,
  });
}

export interface KtiStartResponse {
  displayId: string;
  id: string;
}

export function useKtiStartMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: KtiStartInput) => {
      const res = await apiClient.post<{ success: boolean; data: KtiStartResponse }>(
        '/api/v1/processes/kti/start',
        input,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.processes.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
    },
  });
}

export function useProcessCancelMutation(displayId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => {
      await apiClient.post(`/api/v1/processes/${encodeURIComponent(displayId)}/cancel`, { reason });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.processes.detail(displayId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.processes.lists() });
    },
  });
}

export function useProcessRollbackMutation(displayId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetStepOrder: number; reason: string }) => {
      const res = await apiClient.post<{
        success: boolean;
        data: {
          newActiveTaskId: string;
          newActiveTaskStepKey: string;
          rolledBackFromStepOrder: number;
        };
      }>(`/api/v1/processes/${encodeURIComponent(displayId)}/rollback`, input);
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.processes.detail(displayId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.processes.lists() });
    },
  });
}
