import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { MasterDataType } from '@leanmgmt/shared-schemas';

export interface MasterDataItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  usersCount?: number;
  createdAt: string;
  /** API bazı modellerde döndürmeyebilir */
  updatedAt?: string;
  parentWorkAreaCode?: string | null;
}

export interface MasterDataListFilters {
  isActive?: string;
  search?: string;
  usageFilter?: string;
}

export const MASTER_DATA_TYPE_LABELS: Record<MasterDataType, string> = {
  companies: 'Şirketler',
  locations: 'Lokasyonlar',
  departments: 'Departmanlar',
  levels: 'Seviyeler',
  positions: 'Pozisyonlar',
  teams: 'Takımlar',
  'work-areas': 'Çalışma Alanları',
  'work-sub-areas': 'Çalışma Alt Alanları',
};

function normalizeListPayload(data: MasterDataItem[] | { items: MasterDataItem[] }): {
  items: MasterDataItem[];
} {
  if (Array.isArray(data)) {
    return { items: data };
  }
  return { items: data.items };
}

export function useMasterDataListQuery(type: MasterDataType, filters: MasterDataListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.masterData.list(type, filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: MasterDataItem[] | { items: MasterDataItem[] };
      }>(`/api/v1/master-data/${type}`, { params: filters });
      return normalizeListPayload(res.data.data);
    },
    staleTime: 10 * 60_000,
    enabled: !!type,
  });
}

export function useMasterDataDetailQuery(type: MasterDataType, id: string) {
  return useQuery({
    queryKey: queryKeys.masterData.detail(type, id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: MasterDataItem }>(
        `/api/v1/master-data/${type}/${id}`,
      );
      return res.data.data;
    },
    enabled: !!type && !!id,
    staleTime: 60_000,
  });
}

export function useMasterDataUsersQuery(type: MasterDataType, id: string) {
  return useQuery({
    queryKey: queryKeys.masterData.users(type, id),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: {
          items: Array<{
            id: string;
            sicil: string | null;
            firstName: string;
            lastName: string;
            email: string | null;
            position: { code: string; name: string } | null;
            isActive: boolean;
          }>;
          pagination: { nextCursor: string | null; hasMore: boolean };
        };
      }>(`/api/v1/master-data/${type}/${id}/users`);
      return res.data.data;
    },
    enabled: !!type && !!id,
    staleTime: 30_000,
  });
}

export function useCreateMasterDataMutation(type: MasterDataType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string; name: string; parentWorkAreaCode?: string }) => {
      const res = await apiClient.post<{ success: boolean; data: MasterDataItem }>(
        `/api/v1/master-data/${type}`,
        input,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.masterData.lists(type) });
    },
  });
}

export function useUpdateMasterDataMutation(type: MasterDataType, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const res = await apiClient.patch<{ success: boolean; data: MasterDataItem }>(
        `/api/v1/master-data/${type}/${id}`,
        input,
      );
      return res.data.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.masterData.detail(type, id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.masterData.lists(type) });
    },
  });
}

export function useDeactivateMasterDataMutation(type: MasterDataType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/api/v1/master-data/${type}/${id}/deactivate`);
    },
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.masterData.detail(type, id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.masterData.lists(type) });
    },
  });
}

export function useReactivateMasterDataMutation(type: MasterDataType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/api/v1/master-data/${type}/${id}/reactivate`);
    },
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.masterData.detail(type, id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.masterData.lists(type) });
    },
  });
}

export function useAllMasterDataQuery(type: MasterDataType) {
  return useQuery({
    queryKey: queryKeys.masterData.list(type, { isActive: 'true' }),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: MasterDataItem[] | { items: MasterDataItem[] };
      }>(`/api/v1/master-data/${type}`, { params: { isActive: 'true' } });
      return normalizeListPayload(res.data.data).items;
    },
    staleTime: 10 * 60_000,
  });
}
