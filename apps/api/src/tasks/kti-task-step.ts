import { z } from 'zod';
import { KtiStartBodySchema } from '@leanmgmt/shared-schemas';

export const KTI_STEP = {
  INITIATION: 'KTI_INITIATION',
  MANAGER_APPROVAL: 'KTI_MANAGER_APPROVAL',
  REVISION: 'KTI_REVISION',
} as const;

const KTI_MANAGER_ACTIONS = ['APPROVE', 'REJECT', 'REQUEST_REVISION'] as const;
export type KtiManagerAction = (typeof KTI_MANAGER_ACTIONS)[number];

export const KtiManagerApprovalFormDataSchema = z
  .object({
    comment: z.string().max(1000).optional(),
  })
  .strict();

export function getKtiTaskStepLabel(stepKey: string): string {
  switch (stepKey) {
    case KTI_STEP.INITIATION:
      return 'Başlatma';
    case KTI_STEP.MANAGER_APPROVAL:
      return 'Yönetici Onay';
    case KTI_STEP.REVISION:
      return 'Revize';
    default:
      return 'Görev';
  }
}

/** API §9.6: GET /tasks/:id `formSchema` (İter 2 FE) */
export function getKtiFormSchemaForApiResponse(stepKey: string): { fields: object[] } {
  if (stepKey === KTI_STEP.MANAGER_APPROVAL) {
    return {
      fields: [
        {
          name: 'comment',
          type: 'textarea',
          label: 'Notunuz (opsiyonel)',
          maxLength: 1000,
          required: false,
        },
      ],
    };
  }
  if (stepKey === KTI_STEP.REVISION) {
    return { fields: [] };
  }
  return { fields: [] };
}

export function getKtiManagerAllowedActions(): KtiManagerAction[] {
  return [...KTI_MANAGER_ACTIONS];
}

export function getKtiReasonRequiredForManager(): string[] {
  return ['REJECT', 'REQUEST_REVISION'];
}

export function parseKtiManagerFormData(
  raw: unknown,
): z.infer<typeof KtiManagerApprovalFormDataSchema> {
  return KtiManagerApprovalFormDataSchema.parse(raw ?? {});
}

export function parseKtiRevisionFormData(raw: unknown): z.infer<typeof KtiStartBodySchema> {
  return KtiStartBodySchema.parse(raw);
}
