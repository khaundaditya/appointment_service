import { Module } from '@nestjs/common';
import { RedisCacheModule } from '../../redis/redis.module';
import { UtilityService } from '../../common/libs/utility.service';
import { LoggerService } from '../../logger/logger.service';
import { CustomerJourneyController } from './customerjourney.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MvStores } from '../../appointments/entities/mv-store.view';
import { MvServices } from '../../appointments/entities/mv-service-view.entity';
import { CustomerJourneyService } from './customerjourney.service';
import { MvCutterSchedule } from '../../appointments/entities/mv-cutter-schedule.view';
import { AppointmentsModule } from '../../appointments/appointments.module';
import { FranchisorConfig } from '../../appointments/entities/franchisor-config.entity';
import { UsersModule } from '../../users/users.module';
import { CustomerView } from '../../users/entities/mv-customer.view';
import { Franchisor } from '../../appointments/entities/franchisor.entity';
import { NotificationCategory } from '../../appointments/entities/notification-category.entity';
import { NotificationType } from '../../appointments/entities/notification-type.entity';
import { CustomerCancellationpolicy } from './entities/customer-cancellation.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { AppointmentService } from '../../appointments/entities/appointment-service.entity';
import { MvAppointments } from '../../appointments/entities/mv-appointment.view';
import { AuditRabbitMQModule } from '../../audit-rabbitmq/audit-rabbitmq.module';
import { RabbitMQModule } from '../../rabbitmq/rabbitmq.module';
import { CustomerUser } from '../../users/entities/customer-user.entity';
import { CustomerGuestUser } from '../../users/entities/customer-guest-user.entity';
import { CustomerJourneyUtility } from './customerjourney.utility';
import { StoreServices } from './entities/service.entity';
import { MvBrands } from '../../appointments/entities/mv-brands.view';
import { ECSLoggerService } from '../../logger/ECSlogger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentService,
      MvStores,
      MvCutterSchedule,
      FranchisorConfig,
      MvServices,
      CustomerView,
      Franchisor,
      NotificationCategory,
      NotificationType,
      CustomerCancellationpolicy,
      MvAppointments,
      CustomerUser,
      CustomerGuestUser,
      StoreServices,
      MvBrands,
    ]),
    RedisCacheModule,
    AppointmentsModule,
    UsersModule,
    AuditRabbitMQModule,
    RabbitMQModule,
  ],
  controllers: [CustomerJourneyController],
  providers: [
    CustomerJourneyService,
    UtilityService,
    LoggerService,
    CustomerJourneyUtility,
    ECSLoggerService,
  ],
})
export class CustomerJourneyModule {}
