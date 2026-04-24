import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

import { AppException } from '../exceptions/app.exception.js';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const first = parsed.error.flatten();
      throw new AppException('VALIDATION_FAILED', 'Formu kontrol edin.', 400, {
        fieldErrors: first.fieldErrors,
        formErrors: first.formErrors,
      });
    }
    return parsed.data;
  }
}

/** Nest factory pipe — class yerine şema ile kullanım */
export function createZodValidationPipe<T>(schema: ZodSchema<T>): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}
