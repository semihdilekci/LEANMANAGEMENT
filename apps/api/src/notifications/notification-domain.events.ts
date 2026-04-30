/** EventEmitter2 string adları — domain servisleri ile aynı sözleşme */
export const NOTIFICATION_DOMAIN_EVENT = {
  TASK_ASSIGNED: 'task.assigned',
  TASK_CLAIMED_BY_PEER: 'task.claimed_by_peer',
  TASK_COMPLETED: 'task.completed',
  PROCESS_CANCELLED: 'process.cancelled',
  PROCESS_ROLLBACK_PERFORMED: 'process.rollback_performed',
  ROLE_ASSIGNED: 'role.assigned',
  CONSENT_VERSION_PUBLISHED: 'consent.version_published',
} as const;

export type TaskAssignedPayload = {
  taskId: string;
  userId: string;
  processDisplayId?: string;
};

export type TaskClaimedByPeerPayload = {
  taskId: string;
  skippedUserIds: string[];
};

export type TaskCompletedPayload = {
  taskId: string;
  processId: string;
};

export type ProcessCancelledPayload = {
  processId: string;
  displayId: string;
  startedByUserId: string;
};

export type ProcessRollbackPerformedPayload = {
  processId: string;
  displayId: string;
  newTaskId: string;
  assigneeUserId: string;
  startedByUserId: string;
};

export type RoleAssignedPayload = {
  userId: string;
  roleName: string;
  roleCode: string;
};

export type ConsentVersionPublishedPayload = {
  versionId: string;
};
