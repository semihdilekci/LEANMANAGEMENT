import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Mutating isteklerde audit — İter 3’te @Audit decorator + Prisma audit_logs ile doldurulacak.
 * docs/04_BACKEND_SPEC.md §interceptor
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle();
  }
}
