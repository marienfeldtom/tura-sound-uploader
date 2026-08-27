import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LowdbService } from './lowdb/lowdb.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MannschaftenModule } from './mannschaften/mannschaften.module';
import { UsersService } from './users/users.service';
import { MannschaftenService } from './mannschaften/mannschaften.service';

@Module({
  imports: [AuthModule, UsersModule, MannschaftenModule],
  controllers: [AppController],
  providers: [AppService, LowdbService, UsersService, MannschaftenService],
})
export class AppModule {}
