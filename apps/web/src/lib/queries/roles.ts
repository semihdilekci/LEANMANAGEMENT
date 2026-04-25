import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export interface RoleListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissionCount: number;
  userCount: number;
  createdAt: string;
}

export interface RoleDetail extends RoleListItem {
  permissions: string[];
  ruleCount: number;
}

export interface PermissionMetaItem {
  key: string;
  category: string;
  description: string;
  isSensitive: boolean;
}

export interface RolePermissionRow {
  key: string;
  grantedAt: string;
}

export interface RoleRuleRow {
  id: string;
  order: number;
  isActive: boolean;
  matchingUserCount: number;
  conditionSets: {
    id: string;
    order: number;
    conditions: { id: string; attributeKey: string; operator: string; value: unknown }[];
  }[];
}

export interface RoleUserRow {
  user: {
    id: string;
    sicil: string;
    firstName: string;
    lastName: string;
    email: string;
    company: { id: string; code: string; name: string };
    position: { id: string; code: string; name: string };
  };
  source: 'DIRECT' | 'ATTRIBUTE_RULE';
  assignedAt?: string;
  assignedByUserId?: string;
  matchedRuleId?: string;
  matchedConditionSetOrder?: number;
}

interface RoleListFilters {
  isActive?: string;
  isSystem?: string;
  search?: string;
}

export function usePermissionMetadataQuery() {
  return useQuery({
    queryKey: queryKeys.permissions.metadata(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: PermissionMetaItem[] }>(
        '/api/v1/permissions',
      );
      return res.data.data;
    },
    staleTime: 3_600_000,
  });
}

export function useRoleListQuery(filters: RoleListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.roles.list(filters),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: RoleListItem[] }>('/api/v1/roles', {
        params: filters,
      });
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function useRoleDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.roles.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: RoleDetail }>(
        `/api/v1/roles/${id}`,
      );
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useRolePermissionsQuery(roleId: string) {
  return useQuery({
    queryKey: queryKeys.roles.permissions(roleId),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: RolePermissionRow[] }>(
        `/api/v1/roles/${roleId}/permissions`,
      );
      return res.data.data;
    },
    enabled: !!roleId,
    staleTime: 30_000,
  });
}

export function useRoleRulesQuery(roleId: string) {
  return useQuery({
    queryKey: queryKeys.roles.rules(roleId),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: RoleRuleRow[] }>(
        `/api/v1/roles/${roleId}/rules`,
      );
      return res.data.data;
    },
    enabled: !!roleId,
    staleTime: 60_000,
  });
}

export function useRoleUsersQuery(
  roleId: string,
  params: { source?: string; search?: string; cursor?: string; limit?: number } = {},
) {
  return useQuery({
    queryKey: queryKeys.roles.users(roleId, params),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: { items: RoleUserRow[]; pagination: { nextCursor: string | null; hasMore: boolean } };
      }>(`/api/v1/roles/${roleId}/users`, { params });
      return res.data.data;
    },
    enabled: !!roleId,
    staleTime: 30_000,
  });
}

export function useCreateRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string; name: string; description?: string }) => {
      const res = await apiClient.post<{ success: boolean; data: RoleListItem }>(
        '/api/v1/roles',
        input,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.lists() });
    },
  });
}

export function useUpdateRoleMutation(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name?: string; description?: string | null }) => {
      const res = await apiClient.patch<{ success: boolean; data: RoleListItem }>(
        `/api/v1/roles/${roleId}`,
        input,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.detail(roleId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.lists() });
    },
  });
}

export function useDeleteRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roleId: string) => {
      await apiClient.delete(`/api/v1/roles/${roleId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.lists() });
    },
  });
}

export function useReplaceRolePermissionsMutation(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (permissionKeys: string[]) => {
      const res = await apiClient.put<{ success: boolean; data: { permissionKeys: string[] } }>(
        `/api/v1/roles/${roleId}/permissions`,
        { permissionKeys },
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.permissions(roleId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.detail(roleId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.lists() });
    },
  });
}

export function useCreateRoleRuleMutation(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { order?: number; conditionSets: { conditions: unknown[] }[] }) => {
      const res = await apiClient.post<{ success: boolean; data: { id: string } }>(
        `/api/v1/roles/${roleId}/rules`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.rules(roleId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.detail(roleId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

export function usePatchRoleRuleMutation(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ruleId,
      body,
    }: {
      ruleId: string;
      body: { isActive?: boolean; order?: number; conditionSets?: { conditions: unknown[] }[] };
    }) => {
      await apiClient.patch(`/api/v1/roles/${roleId}/rules/${ruleId}`, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.rules(roleId) });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.roles.detail(roleId), 'users'],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

export function useDeleteRoleRuleMutation(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      await apiClient.delete(`/api/v1/roles/${roleId}/rules/${ruleId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.rules(roleId) });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.roles.detail(roleId), 'users'],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

export function useTestRoleRuleMutation(roleId: string) {
  return useMutation({
    mutationFn: async (body: { conditionSets: { conditions: unknown[] }[] }) => {
      const res = await apiClient.post<{
        success: boolean;
        data: {
          matchingUserCount: number;
          sampleUsers: {
            id: string;
            sicil: string;
            firstName: string;
            lastName: string;
            company: { id: string; code: string; name: string };
            position: { id: string; code: string; name: string };
          }[];
        };
      }>(`/api/v1/roles/${roleId}/rules/test`, body);
      return res.data.data;
    },
  });
}

export function useAssignUserToRoleMutation(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiClient.post<{
        success: boolean;
        data: { userRoleId: string; assignedAt: string };
      }>(`/api/v1/roles/${roleId}/users`, { userId });
      return res.data.data;
    },
    onSuccess: (_, userId) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.roles.detail(roleId), 'users'],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.roles(userId) });
    },
  });
}

export function useUnassignUserFromRoleMutation(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/api/v1/roles/${roleId}/users/${userId}`);
    },
    onSuccess: (_, userId) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.roles.detail(roleId), 'users'],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.roles(userId) });
    },
  });
}
