import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  EmailTemplatePreviewInput,
  EmailTemplateSendTestInput,
  UpdateEmailTemplateInput,
} from '@leanmgmt/shared-schemas';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export interface EmailTemplateSummary {
  id: string;
  eventType: string;
  subjectTemplate: string;
  updatedAt: string;
  updatedByUserId: string | null;
}

export interface EmailTemplateDetail {
  id: string;
  eventType: string;
  subjectTemplate: string;
  htmlBodyTemplate: string;
  textBodyTemplate: string;
  requiredVariables: string[];
  updatedAt: string;
  updatedByUserId: string | null;
}

export interface EmailTemplatePreviewResult {
  subjectRendered: string;
  htmlBodyRendered: string;
  textBodyRendered: string;
  unresolvedVariables: string[];
}

export function useEmailTemplatesListQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.emailTemplates.list(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: EmailTemplateSummary[] }>(
        '/api/v1/admin/email-templates',
      );
      return res.data.data;
    },
    staleTime: 120_000,
    enabled,
  });
}

export function useEmailTemplateDetailQuery(eventType: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.emailTemplates.detail(eventType),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: EmailTemplateDetail }>(
        `/api/v1/admin/email-templates/${encodeURIComponent(eventType)}`,
      );
      return res.data.data;
    },
    staleTime: 300_000,
    enabled: enabled && !!eventType,
  });
}

export function useUpdateEmailTemplateMutation(eventType: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateEmailTemplateInput) => {
      const res = await apiClient.put<{ success: boolean; data: EmailTemplateDetail }>(
        `/api/v1/admin/email-templates/${encodeURIComponent(eventType)}`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.emailTemplates.all() });
    },
  });
}

export function useEmailTemplatePreviewMutation(eventType: string) {
  return useMutation({
    mutationFn: async (body: EmailTemplatePreviewInput) => {
      const res = await apiClient.post<{ success: boolean; data: EmailTemplatePreviewResult }>(
        `/api/v1/admin/email-templates/${encodeURIComponent(eventType)}/preview`,
        body,
      );
      return res.data.data;
    },
  });
}

export function useEmailTemplateSendTestMutation(eventType: string) {
  return useMutation({
    mutationFn: async (body: EmailTemplateSendTestInput) => {
      const res = await apiClient.post<{
        success: boolean;
        data: { sent: boolean; mode: string };
      }>(`/api/v1/admin/email-templates/${encodeURIComponent(eventType)}/send-test`, body);
      return res.data.data;
    },
  });
}
