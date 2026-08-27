import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { LowdbService } from '../lowdb/lowdb.service';

@Module({
  providers: [UsersService, LowdbService],
  exports: [UsersService],
})
export class UsersModule {}
