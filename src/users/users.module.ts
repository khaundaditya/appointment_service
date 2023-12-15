import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CustomerUser } from './entities/customer-user.entity';
import { CustomerPreference } from './entities/customer-preference.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilityService } from '../common/libs/utility.service';
import { LoggerService } from '../logger/logger.service';
import { AuthModuleOptions } from '@nestjs/passport';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerUser, CustomerPreference]),
    AuthModuleOptions,
  ],
  controllers: [UsersController],
  providers: [UsersService, UtilityService, LoggerService],
  exports: [UsersService],
})
export class UsersModule {}
