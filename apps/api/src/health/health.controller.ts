import { Controller, Get } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
