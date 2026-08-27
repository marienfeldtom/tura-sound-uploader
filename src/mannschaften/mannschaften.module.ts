import { Module } from '@nestjs/common';
import { MannschaftenService } from './mannschaften.service';

@Module({
  providers: [MannschaftenService],
  exports: [MannschaftenService],
})
export class MannschaftenModule {}
