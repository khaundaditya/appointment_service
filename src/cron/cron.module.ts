import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { LoggerService } from '../logger/logger.service';
import { CronService } from './cron.service';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment])],
  providers: [CronService, LoggerService],
})
export class CronModule {}
