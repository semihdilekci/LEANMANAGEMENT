import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import type { Env } from '../../config/env.schema.js';
import { RedisService } from '../../redis/redis.service.js';
import {
  AuthSessionRevokedException,
  AuthTokenExpiredException,
  AuthTokenInvalidException,
} from '../auth.exceptions.js';
import type { AccessTokenPayload } from '../auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new AuthTokenInvalidException();
    }
    const token = auth.slice(7).trim();
    if (!token) {
      throw new AuthTokenInvalidException();
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET_CURRENT', { infer: true }),
        algorithms: ['HS256'],
      });
      const revoked = await this.redis.raw.get(`access_jti_revoked:${payload.jti}`);
      if (revoked) {
        throw new AuthSessionRevokedException();
      }
      request.user = {
        id: payload.sub,
        sessionId: payload.sid,
        jti: payload.jti,
      };
      return true;
    } catch (err) {
      if (err instanceof AuthSessionRevokedException) {
        throw err;
      }
      const name =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name: unknown }).name)
          : '';
      if (name === 'TokenExpiredError') {
        throw new AuthTokenExpiredException();
      }
      throw new AuthTokenInvalidException();
    }
  }
}
