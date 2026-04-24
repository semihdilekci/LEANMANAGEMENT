import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export interface UserListItem {
  id: string;
  sicil: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  company: { id: string; code: string; name: string };
  position: { id: string; code: string; name: string };
  isActive: boolean;
  createdAt: string;
}

export interface UserDetail extends UserListItem {
  phone: string | null;
  employeeType: string;
  locationId: string;
  departmentId: string;
  levelId: string;
  teamId: string | null;
  workAreaId: string;
  workSubAreaId: string | null;
  managerUserId: string | null;
  hireDate: string | null;
  anonymizedAt: string | null;
  location: { id: string; code: string; name: string };
  department: { id: string; code: string; name: string };
  level: { id: string; code: string; name: string };
  team: { id: string; code: string; name: string } | null;
  workArea: { id: string; code: string; name: string };
  workSubArea: { id: string; code: string; name: string } | null;
  manager: { id: string; sicil: string; firstName: string; lastName: string } | null;
  roles: UserRole[];
}

export interface UserRole {
  id: string;
  code: string;
  name: string;
  source: 'DIRECT' | 'ATTRIBUTE_RULE';
  assignedAt: string;
  assignedByUserId: string;
}

export interface UserSession {
  id: string;
  status: string;
  ipHash: string;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
}

export interface UserListFilters {
  cursor?: string;
  search?: string;
  companyId?: string;
  locationId?: string;
  departmentId?: string;
  positionId?: string;
  levelId?: string;
  isActive?: string;
  employeeType?: string;
  sort?: string;
  limit?: number;
}

export function useUserListQuery(filters: UserListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: {
          items: UserListItem[];
          pagination: { nextCursor: string | null; hasMore: boolean };
        };
      }>('/api/v1/users', { params: filters });
      return res.data.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: UserDetail }>(
        `/api/v1/users/${id}`,
      );
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useUserRolesQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.users.roles(id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: UserRole[] }>(
        `/api/v1/users/${id}/roles`,
      );
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useUserSessionsQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.users.sessions(id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: UserSession[] }>(
        `/api/v1/users/${id}/sessions`,
      );
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 0,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const res = await apiClient.post<{ success: boolean; data: UserDetail }>(
        '/api/v1/users',
        input,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

export function useUpdateUserMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const res = await apiClient.patch<{ success: boolean; data: UserDetail }>(
        `/api/v1/users/${id}`,
        input,
      );
      return res.data.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.users.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

export function useDeactivateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiClient.post(`/api/v1/users/${id}/deactivate`, { reason });
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

export function useReactivateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiClient.post(`/api/v1/users/${id}/reactivate`, { reason });
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

export function useAnonymizeUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiClient.post(`/api/v1/users/${id}/anonymize`, { reason });
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, sessionId }: { userId: string; sessionId: string }) => {
      await apiClient.delete(`/api/v1/users/${userId}/sessions/${sessionId}`);
    },
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.sessions(userId) });
    },
  });
}

export function useRevokeAllSessionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/api/v1/users/${userId}/sessions`);
    },
    onSuccess: (_, userId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.sessions(userId) });
    },
  });
}
