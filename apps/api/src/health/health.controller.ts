import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../common/decorators/public.decorator.js';

@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  @Public()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
