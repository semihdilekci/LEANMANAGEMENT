import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  ChangePasswordSchema,
  ConsentAcceptSchema,
  LoginSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  type ChangePasswordInput,
  type ConsentAcceptInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
} from '@leanmgmt/shared-schemas';

import { Public } from '../common/decorators/public.decorator.js';
import { SkipConsent } from '../common/decorators/skip-consent.decorator.js';
import { SkipCsrf } from '../common/decorators/skip-csrf.decorator.js';
import { SkipEnvelope } from '../common/decorators/skip-envelope.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { AuthService } from './auth.service.js';
import type { AccessTokenPayload } from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @SkipCsrf()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(createZodValidationPipe(LoginSchema)) dto: LoginInput,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Record<string, unknown>> {
    return this.auth.login(dto, req.ip ?? '0.0.0.0', req.headers['user-agent'] ?? '', reply);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Record<string, unknown>> {
    const h = req.headers['x-csrf-token'];
    const csrfHeader = typeof h === 'string' ? h : Array.isArray(h) ? h[0] : undefined;
    return this.auth.refresh(
      req.ip ?? '0.0.0.0',
      req.headers['user-agent'] ?? '',
      req.cookies?.refresh_token,
      csrfHeader,
      reply,
    );
  }

  @SkipConsent()
  @SkipEnvelope()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const actor: AccessTokenPayload = { sub: user.id, sid: user.sessionId, jti: user.jti };
    await this.auth.logout(
      actor,
      req.ip ?? '0.0.0.0',
      req.headers['user-agent'] ?? '',
      req.cookies?.refresh_token,
      reply,
    );
  }

  @Public()
  @SkipCsrf()
  @Post('password-reset-request')
  @HttpCode(200)
  async passwordResetRequest(
    @Body(createZodValidationPipe(PasswordResetRequestSchema)) dto: PasswordResetRequestInput,
    @Req() req: FastifyRequest,
  ): Promise<Record<string, unknown>> {
    return this.auth.passwordResetRequest(
      dto,
      req.ip ?? '0.0.0.0',
      req.headers['user-agent'] ?? '',
    );
  }

  @Public()
  @SkipCsrf()
  @Post('password-reset-confirm')
  @HttpCode(200)
  async passwordResetConfirm(
    @Body(createZodValidationPipe(PasswordResetConfirmSchema)) dto: PasswordResetConfirmInput,
    @Req() req: FastifyRequest,
  ): Promise<Record<string, unknown>> {
    return this.auth.passwordResetConfirm(dto, req.ip ?? '0.0.0.0');
  }

  @SkipEnvelope()
  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(createZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordInput,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const actor: AccessTokenPayload = { sub: user.id, sid: user.sessionId, jti: user.jti };
    await this.auth.changePassword(
      actor,
      dto,
      req.ip ?? '0.0.0.0',
      req.headers['user-agent'] ?? '',
      reply,
    );
  }

  @SkipConsent()
  @Get('me')
  @HttpCode(200)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<Record<string, unknown>> {
    return this.auth.getMe(user.id);
  }

  @SkipConsent()
  @Post('consent/accept')
  @HttpCode(200)
  async acceptConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body(createZodValidationPipe(ConsentAcceptSchema)) dto: ConsentAcceptInput,
    @Req() req: FastifyRequest,
  ): Promise<Record<string, unknown>> {
    const actor: AccessTokenPayload = { sub: user.id, sid: user.sessionId, jti: user.jti };
    return this.auth.acceptConsent(
      actor,
      dto,
      req.ip ?? '0.0.0.0',
      req.headers['user-agent'] ?? '',
    );
  }
}
