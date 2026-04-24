import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit:metadata';

export type AuditMetadata = {
  action: string;
  entity: string;
};

export const Audit = (action: string, entity: string) =>
  SetMetadata(AUDIT_METADATA_KEY, { action, entity } satisfies AuditMetadata);
