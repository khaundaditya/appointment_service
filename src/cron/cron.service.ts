import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Repository } from 'typeorm';
import * as moment from 'moment';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class CronService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private readonly loggerService: LoggerService,
  ) {}

  public logger = this.loggerService.initiateLogger();

  // will execute at 11:59 midnight
  @Cron('59 23 * * *')
  async updateAppointmentStatus() {
    try {
      this.logger.info('*************** CRON is started ****************');
      const date = moment().format('YYYY-MM-DD 23:59:59');

      const data = await this.appointmentRepository.query(
        `
          UPDATE appointment_appointment SET status = 'completed', is_updated_by_cron = 1
          WHERE appointment_time < '${date}' AND status != 'completed' AND (is_updated_by_cron = 0 OR is_updated_by_cron IS null)
        `,
      );

      this.logger.info(
        `+++++++ Total affected rows : ${date} ---- ${data[1]} +++++++`,
      );
      this.logger.info('-------------- CRON is ended --------------');
    } catch (error) {
      console.log(error);
    }
  }
}
