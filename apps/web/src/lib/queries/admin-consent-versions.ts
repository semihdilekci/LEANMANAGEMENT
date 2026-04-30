import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AdminConsentVersionCreateBody,
  AdminConsentVersionPatchBody,
  AdminConsentVersionPublishBody,
} from '@leanmgmt/shared-schemas';

import { apiClient } from '@/lib/api-client';
import { authQueryKeys } from '@/lib/queries/auth';
import { queryKeys } from '@/lib/query-keys';

export type AdminConsentVersionListItem = {
  id: string;
  version: number;
  status: string;
  effectiveFrom: string | null;
  publishedAt: string | null;
  createdByUserId: string;
  isActive: boolean;
  acceptedUserCount: number;
};

export type AdminConsentVersionDetail = {
  id: string;
  version: number;
  status: string;
  effectiveFrom: string | null;
  publishedAt: string | null;
  createdByUserId: string;
  title: string;
  body: string;
  locale: string;
  content: string;
  isActive: boolean;
};

export function useConsentVersionsListQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.consentVersions.list(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: AdminConsentVersionListItem[] }>(
        '/api/v1/admin/consent-versions',
      );
      return res.data.data;
    },
    staleTime: 30_000,
    enabled,
  });
}

export function useConsentVersionDetailQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.consentVersions.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: AdminConsentVersionDetail }>(
        `/api/v1/admin/consent-versions/${encodeURIComponent(id)}`,
      );
      return res.data.data;
    },
    staleTime: 15_000,
    enabled: enabled && !!id,
  });
}

export type AdminConsentVersionCreateResult = {
  id: string;
  version: number;
  status: string;
  effectiveFrom: null;
  publishedAt: null;
  createdByUserId: string;
};

export function useCreateConsentVersionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AdminConsentVersionCreateBody) => {
      const res = await apiClient.post<{ success: boolean; data: AdminConsentVersionCreateResult }>(
        '/api/v1/admin/consent-versions',
        body,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.consentVersions.all() });
    },
  });
}

export function usePatchConsentVersionMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AdminConsentVersionPatchBody) => {
      const res = await apiClient.patch<{ success: boolean; data: unknown }>(
        `/api/v1/admin/consent-versions/${encodeURIComponent(id)}`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.consentVersions.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.consentVersions.detail(id) });
    },
  });
}

export function usePublishConsentVersionMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AdminConsentVersionPublishBody) => {
      const res = await apiClient.post<{ success: boolean; data: unknown }>(
        `/api/v1/admin/consent-versions/${encodeURIComponent(id)}/publish`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.consentVersions.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.consentVersions.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.systemSettings.all() });
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
    },
  });
}
