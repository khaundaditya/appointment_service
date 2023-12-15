import { Module } from '@nestjs/common';
import { Transport, ClientsModule } from '@nestjs/microservices';
import { RedisCacheModule } from '../../../redis/redis.module';
import { LoggerService } from '../../../logger/logger.service';
import { UpdateRedisKeyMQController } from './update-redis-key.controller';
const queueName = `${process.env.MODE}_update_redis_key_queue`;

@Module({
  imports: [
    RedisCacheModule,
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
  ],
  controllers: [UpdateRedisKeyMQController],
  providers: [LoggerService],
})
export class UpdateRedisKeyMQMOduole {}
