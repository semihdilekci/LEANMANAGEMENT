import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SKIP_ENVELOPE_KEY } from '../decorators/skip-envelope.decorator.js';

/** docs/04_BACKEND_SPEC.md — { success: true, data } */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ success: true; data: unknown } | unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip === true) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data: unknown) => {
        return { success: true as const, data };
      }),
    );
  }
}
