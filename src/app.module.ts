import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configService } from './common/config/config.service';
import { AppointmentsModule } from './appointments/appointments.module';
import { UsersModule } from './users/users.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module';
import { CancelInvoiceRabbitMqModule } from './invoice-cancel-rabbitmq/invoice-cancel-rabbitmq.module';
import { CustomerJourneyModule } from './v2/customer-journey/customerjourney.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(configService.getTypeOrmConfig()),
    AuthModule,
    AppointmentsModule,
    CloudinaryModule,
    UsersModule,
    ScheduleModule.forRoot(),
    CronModule,
    CancelInvoiceRabbitMqModule,
    CustomerJourneyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
