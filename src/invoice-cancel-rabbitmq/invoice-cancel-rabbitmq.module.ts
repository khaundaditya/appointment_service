import { Module } from '@nestjs/common';
import { Transport, ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configService } from '../common/config/config.service';
import { Appointment } from '../appointments/entities/appointment.entity';
import { LoggerService } from '../logger/logger.service';
import { CancelInvoiceController } from './invoice-cancel-rabbitmq.controller';
import { CancelInvoiceRabitMQService } from './invoice-cancel-rabbitmq.service';
const queueName = `${process.env.MODE}_invoice_cancel_queue`;
import { NotificationCategory } from '../appointments/entities/notification-category.entity';
import { NotificationType } from '../appointments/entities/notification-type.entity';
import { MvBrands } from '../appointments/entities/mv-brands.view';
import { MvStores } from '../appointments/entities/mv-store.view';
import { UsersModule } from '../users/users.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { MvCutterSchedule } from '../appointments/entities/mv-cutter-schedule.view';

@Module({
  imports: [
    TypeOrmModule.forRoot(configService.getTypeOrmConfig()),
    TypeOrmModule.forFeature([
      Appointment,
      NotificationCategory,
      NotificationType,
      MvBrands,
      MvStores,
      MvCutterSchedule,
    ]),
    ClientsModule.register([
      {
        name: `${process.env.MQ_SERVICE_NAME}`,
        transport: Transport.RMQ,
        options: {
          urls: [
            `${process.env.MQ_PREFIX}://${process.env.MQ_USERNAME}:${process.env.MQ_PASSWORD}@${process.env.MQ_URL}:${process.env.MQ_PORT}`,
          ],
          queue: queueName.toLocaleLowerCase(),
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
    UsersModule,
    RabbitMQModule,
  ],
  controllers: [CancelInvoiceController],
  providers: [CancelInvoiceRabitMQService, LoggerService],
  exports: [CancelInvoiceRabitMQService],
})
export class CancelInvoiceRabbitMqModule {}
