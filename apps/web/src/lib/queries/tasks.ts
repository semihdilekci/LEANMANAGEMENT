import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TaskCompleteBodyInput, TaskListQuery } from '@leanmgmt/shared-schemas';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export interface TaskListUserBrief {
  id: string;
  sicil: string | null;
  firstName: string;
  lastName: string;
}

export interface TaskListProcessBrief {
  id: string;
  displayId: string;
  processType: string;
  status: string;
  startedBy: TaskListUserBrief;
  startedAt: string;
}

export interface TaskListItem {
  taskId: string;
  stepKey: string;
  stepLabel: string;
  status: string;
  slaDueAt: string | null;
  slaBaselineAt?: string | null;
  isSlaOverdue: boolean;
  assignmentMode: string;
  process: TaskListProcessBrief;
  completedAt?: string | null;
  completionAction?: string | null;
}

export interface TaskDetailProcess {
  id: string;
  displayId: string;
  processType: string;
  status: string;
  startedBy: TaskListUserBrief;
  company: { id: string; code: string; name: string };
}

export interface TaskFormSchemaField {
  name: string;
  type: string;
  label: string;
  maxLength?: number;
  required?: boolean;
}

export interface TaskDetail {
  id: string;
  stepKey: string;
  stepLabel: string;
  status: string;
  assignmentMode: string;
  slaDueAt: string | null;
  slaBaselineAt?: string | null;
  isSlaOverdue: boolean;
  allowedActions: string[];
  reasonRequiredFor: string[];
  process: TaskDetailProcess;
  previousTasks: Array<{
    stepKey: string;
    stepLabel: string;
    completedBy: TaskListUserBrief | null;
    completedAt: string | null;
    formData: unknown;
  }>;
  documents: Array<{ id: string; originalFilename: string; scanStatus: string }>;
  formSchema: { fields: TaskFormSchemaField[] };
  formData?: unknown;
}

export interface TaskCompleteResponse {
  taskId: string;
  status: string;
  completedAt: string;
  nextTaskId: string | null;
  processStatus: string;
}

export function useTasksInfiniteQuery(filters: Omit<TaskListQuery, 'cursor'>, enabled = true) {
  const listKey = { ...filters } as TaskListQuery;
  return useInfiniteQuery({
    queryKey: queryKeys.tasks.list(listKey),
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<{
        success: boolean;
        data: {
          items: TaskListItem[];
          pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
        };
      }>('/api/v1/tasks', {
        params: { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
      });
      return res.data.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.pagination.hasMore && last.pagination.nextCursor
        ? last.pagination.nextCursor
        : undefined,
    staleTime: 15_000,
    enabled,
  });
}

export function useTaskDetailQuery(taskId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: TaskDetail }>(
        `/api/v1/tasks/${encodeURIComponent(taskId)}`,
      );
      return res.data.data;
    },
    enabled: !!taskId,
    staleTime: 10_000,
  });
}

export function useTaskClaimMutation(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{
        success: boolean;
        data: { taskId: string; claimedAt: string };
      }>(`/api/v1/tasks/${encodeURIComponent(taskId)}/claim`, {});
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
    },
  });
}

export function useTaskCompleteMutation(taskId: string, displayId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: TaskCompleteBodyInput) => {
      const res = await apiClient.post<{ success: boolean; data: TaskCompleteResponse }>(
        `/api/v1/tasks/${encodeURIComponent(taskId)}/complete`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.processes.detail(displayId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.processes.lists() });
    },
  });
}
