import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { UsersController } from './users.controller.js';
import { UsersSessionsController } from './users-sessions.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [UsersController, UsersSessionsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
