import 'dotenv/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MvCutterSchedule } from '../../appointments/entities/mv-cutter-schedule.view';
import { CustomerUser } from '../../users/entities/customer-user.entity';
import { MvStores } from '../../appointments/entities/mv-store.view';
import { MvServices } from '../../appointments/entities/mv-service-view.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { AppointmentService } from '../../appointments/entities/appointment-service.entity';
import { EmployeeSkill } from '../../appointments/entities/employee-skill.entity';
import { ServiceSkills } from '../../appointments/entities/service-skill.entity';
import { CustomerWalkout } from '../../appointments/entities/customer-walkout.entity';
import { NotificationCategory } from '../../appointments/entities/notification-category.entity';
import { NotificationType } from '../../appointments/entities/notification-type.entity';
import { FranchisorConfig } from '../../appointments/entities/franchisor-config.entity';
import { Franchisor } from '../../appointments/entities/franchisor.entity';
import { CustomerProfile } from '../../users/entities/customer-profile.entity';
import { CustomerPreference } from '../../users/entities/customer-preference.entity';
import { CustomerGuestUser } from '../../users/entities/customer-guest-user.entity';
import { MvAppointments } from '../../appointments/entities/mv-appointment.view';
import { CustomerView } from '../../users/entities/mv-customer.view';
import { CustomerCancellationpolicy } from '../../v2/customer-journey/entities/customer-cancellation.entity';
import { MvBrands } from '../../appointments/entities/mv-brands.view';
import { StoreServices } from '../../v2/customer-journey/entities/service.entity';
import { ServiceOptions } from '../../v2/customer-journey/entities/service-options.entity';

class ConfigService {
  constructor(private env: { [k: string]: string | undefined }) {}

  private getValue(key: string, throwOnMissing = true): string {
    const value = this.env[key];
    if (!value && throwOnMissing) {
      throw new Error(`config error - missing env.${key}`);
    }

    return value;
  }

  public ensureValues(keys: string[]) {
    keys.forEach((k) => this.getValue(k, true));
    return this;
  }

  public getPort() {
    return this.getValue('PORT', true);
  }

  public isProduction() {
    const mode = this.getValue('MODE', false);
    return mode != 'DEV';
  }

  public getTypeOrmConfig(): TypeOrmModuleOptions {
    return {
      type: 'postgres',

      host: this.getValue('POSTGRES_HOST'),
      port: parseInt(this.getValue('POSTGRES_PORT')),
      username: this.getValue('POSTGRES_USER'),
      password: this.getValue('POSTGRES_PASSWORD'),
      database: this.getValue('POSTGRES_DATABASE'),
      entities: [
        MvCutterSchedule,
        CustomerUser,
        MvStores,
        MvServices,
        Appointment,
        AppointmentService,
        EmployeeSkill,
        ServiceSkills,
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
        CustomerCancellationpolicy,
        MvBrands,
        StoreServices,
        ServiceOptions,
      ],
      synchronize: false,
      keepConnectionAlive: true,
    };
  }
}

const configService = new ConfigService(process.env).ensureValues([
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DATABASE',
]);

export { configService };
