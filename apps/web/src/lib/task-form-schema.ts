import { z } from 'zod';

import type { TaskFormSchemaField } from '@/lib/queries/tasks';

/**
 * API `formSchema.fields` → submit öncesi doğrulama (RHF zodResolver ile uyumlu).
 */
export function buildZodFromTaskFormFields(
  fields: TaskFormSchemaField[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (f.type === 'textarea' || f.type === 'text') {
      let base = z.string();
      if (f.maxLength != null) {
        base = base.max(f.maxLength, `En fazla ${f.maxLength} karakter`);
      }
      const fieldSchema: z.ZodTypeAny = f.required ? base.min(1, 'Zorunlu alan') : base.optional();
      shape[f.name] = fieldSchema;
    } else {
      shape[f.name] = z.unknown().optional();
    }
  }
  return z.object(shape).strict();
}
