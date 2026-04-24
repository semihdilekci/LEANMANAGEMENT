import { timingSafeEqual } from 'node:crypto';

import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { SKIP_CSRF_KEY } from '../../common/decorators/skip-csrf.decorator.js';
import { CsrfTokenInvalidException } from '../auth.exceptions.js';

function headersEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipCsrf === true) {
      return true;
    }

    const rawHeader = request.headers['x-csrf-token'];
    const header =
      typeof rawHeader === 'string' ? rawHeader : Array.isArray(rawHeader) ? rawHeader[0] : '';
    const cookie = request.cookies?.csrf_token;
    if (!header || !cookie || !headersEqual(header, cookie)) {
      throw new CsrfTokenInvalidException();
    }
    return true;
  }
}
