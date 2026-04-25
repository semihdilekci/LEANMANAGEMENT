import type { MasterDataType, TaskListQuery } from '@leanmgmt/shared-schemas';

interface UserListFilters {
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

interface MasterDataListFilters {
  isActive?: string;
  search?: string;
  usageFilter?: string;
}

interface RoleListFilters {
  isActive?: string;
  isSystem?: string;
  search?: string;
}

export interface ProcessListFilters {
  scope?: string;
  status?: string;
  processType?: string;
  displayId?: string;
  startedAtFrom?: string;
  startedAtTo?: string;
  startedByUserId?: string;
  companyId?: string;
  showCancelled?: string;
  limit?: number;
  cursor?: string;
  sort?: string;
}

export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
    consentVersion: (id: string) => ['auth', 'consent-version', id] as const,
  },
  permissions: {
    all: () => ['permissions'] as const,
    metadata: () => [...queryKeys.permissions.all(), 'metadata'] as const,
  },
  roles: {
    all: () => ['roles'] as const,
    lists: () => [...queryKeys.roles.all(), 'list'] as const,
    list: (filters?: RoleListFilters) => [...queryKeys.roles.lists(), filters ?? {}] as const,
    details: () => [...queryKeys.roles.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.roles.details(), id] as const,
    permissions: (id: string) => [...queryKeys.roles.detail(id), 'permissions'] as const,
    rules: (id: string) => [...queryKeys.roles.detail(id), 'rules'] as const,
    users: (id: string, filters?: { source?: string; search?: string; cursor?: string }) =>
      [...queryKeys.roles.detail(id), 'users', filters ?? {}] as const,
  },
  users: {
    all: () => ['users'] as const,
    lists: () => [...queryKeys.users.all(), 'list'] as const,
    list: (filters?: UserListFilters) => [...queryKeys.users.lists(), filters ?? {}] as const,
    details: () => [...queryKeys.users.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    roles: (id: string) => [...queryKeys.users.detail(id), 'roles'] as const,
    sessions: (id: string) => [...queryKeys.users.detail(id), 'sessions'] as const,
  },
  processes: {
    all: () => ['processes'] as const,
    lists: () => [...queryKeys.processes.all(), 'list'] as const,
    list: (filters?: ProcessListFilters) =>
      [...queryKeys.processes.lists(), filters ?? {}] as const,
    details: () => [...queryKeys.processes.all(), 'detail'] as const,
    detail: (displayId: string) => [...queryKeys.processes.details(), displayId] as const,
  },
  tasks: {
    all: () => ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all(), 'list'] as const,
    list: (filters?: TaskListQuery) => [...queryKeys.tasks.lists(), filters ?? {}] as const,
    details: () => [...queryKeys.tasks.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
  },
  masterData: {
    all: () => ['master-data'] as const,
    type: (type: MasterDataType) => [...queryKeys.masterData.all(), type] as const,
    lists: (type: MasterDataType) => [...queryKeys.masterData.type(type), 'list'] as const,
    list: (type: MasterDataType, filters?: MasterDataListFilters) =>
      [...queryKeys.masterData.lists(type), filters ?? {}] as const,
    details: (type: MasterDataType) => [...queryKeys.masterData.type(type), 'detail'] as const,
    detail: (type: MasterDataType, id: string) =>
      [...queryKeys.masterData.details(type), id] as const,
    users: (type: MasterDataType, id: string) =>
      [...queryKeys.masterData.detail(type, id), 'users'] as const,
  },
} as const;
