import { Module } from '@nestjs/common';
import { CloudinaryController } from './cloudinary.controller';
import { CloudinaryService } from './cloudinary.service';
import { RedisCacheModule } from '../redis/redis.module';
import { LoggerService } from '../logger/logger.service';
import { UtilityService } from '../common/libs/utility.service';

@Module({
  imports: [RedisCacheModule],
  providers: [CloudinaryService, LoggerService, UtilityService],
  exports: [CloudinaryService],
  controllers: [CloudinaryController],
})
export class CloudinaryModule {}
