import { Module } from '@nestjs/common';
import { MannschaftenService } from './mannschaften.service';
import { LowdbService } from '../lowdb/lowdb.service';

@Module({
  providers: [MannschaftenService, LowdbService],
  exports: [MannschaftenService],
})
export class MannschaftenModule {}
