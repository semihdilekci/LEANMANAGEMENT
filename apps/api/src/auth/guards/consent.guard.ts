import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { SKIP_CONSENT_KEY } from '../../common/decorators/skip-consent.decorator.js';
import { AuthConsentRequiredException } from '../auth.exceptions.js';
import { ConsentPolicyService } from '../consent-policy.service.js';

@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConsentPolicyService) private readonly consentPolicy: ConsentPolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const skipConsent = this.reflector.getAllAndOverride<boolean>(SKIP_CONSENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipConsent === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as { id: string } | undefined;
    if (!user?.id) {
      throw new AuthConsentRequiredException();
    }

    const ok = await this.consentPolicy.hasAcceptedActiveVersion(user.id);
    if (!ok) {
      throw new AuthConsentRequiredException();
    }
    return true;
  }
}
