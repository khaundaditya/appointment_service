import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { UtilityService } from '../common/libs/utility.service';
import { MvCutterSchedule } from './entities/mv-cutter-schedule.view';
import { RedisCacheModule } from '../redis/redis.module';
import { MvStores } from './entities/mv-store.view';
import { MvServices } from './entities/mv-service-view.entity';
import { Appointment } from './entities/appointment.entity';
import { AppointmentService } from './entities/appointment-service.entity';
import { LoggerService } from '../logger/logger.service';
import { EmployeeSkill } from './entities/employee-skill.entity';
import { ServiceSkills } from './entities/service-skill.entity';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { AuditRabbitMQModule } from '../audit-rabbitmq/audit-rabbitmq.module';
import { CustomerUser } from '../users/entities/customer-user.entity';
import { CustomerWalkout } from './entities/customer-walkout.entity';
import { NotificationCategory } from './entities/notification-category.entity';
import { NotificationType } from './entities/notification-type.entity';
import { FranchisorConfig } from './entities/franchisor-config.entity';
import { Franchisor } from './entities/franchisor.entity';
import { CustomerProfile } from '../users/entities/customer-profile.entity';
import { CustomerPreference } from '../users/entities/customer-preference.entity';
import { UsersModule } from '../users/users.module';
import { CustomerGuestUser } from '../users/entities/customer-guest-user.entity';
import { CancelInvoiceRabbitMqModule } from '../invoice-cancel-rabbitmq/invoice-cancel-rabbitmq.module';
import { MvAppointments } from './entities/mv-appointment.view';
import { CustomerView } from '../users/entities/mv-customer.view';
import { MvBrands } from './entities/mv-brands.view';
import { ECSLoggerService } from '../logger/ECSlogger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MvCutterSchedule,
      MvStores,
      MvServices,
      Appointment,
      AppointmentService,
      EmployeeSkill,
      ServiceSkills,
      CustomerUser,
      CustomerWalkout,
      NotificationCategory,
      NotificationType,
      FranchisorConfig,
      Franchisor,
      CustomerProfile,
      CustomerPreference,
      CustomerGuestUser,
      MvAppointments,
      CustomerView,
      MvBrands,
    ]),
    RedisCacheModule,
    RabbitMQModule,
    AuditRabbitMQModule,
    UsersModule,
    CancelInvoiceRabbitMqModule,
  ],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    UtilityService,
    LoggerService,
    ECSLoggerService,
  ],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
