import { UnauthorizedException, createParamDecorator, type ExecutionContext } from '@nestjs/common';

export type AuthenticatedUser = {
  id: string;
  sessionId: string;
  jti: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  },
);
