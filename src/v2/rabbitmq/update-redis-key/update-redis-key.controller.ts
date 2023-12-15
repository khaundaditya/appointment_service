import { Controller } from '@nestjs/common';
import { LoggerService } from '../../../logger/logger.service';
import * as amqp from 'amqplib';
import { RedisCacheService } from '../../../redis/redis.service';
import { Constant } from '../../../common/config/constant';

@Controller()
export class UpdateRedisKeyMQController {
  constructor(
    private redisService: RedisCacheService,
    private readonly loggerService: LoggerService,
  ) {
    // this.ListenUpdateRedisKey();
  }

  public logger = this.loggerService.initiateLogger();

  async connectMQ() {
    const url = `${process.env.MQ_PREFIX}://${process.env.MQ_USERNAME}:${process.env.MQ_PASSWORD}@${process.env.MQ_URL}:${process.env.MQ_PORT}`;

    const connection = await amqp.connect(url);

    const channel = await connection.createChannel();

    return channel;
  }

  async ListenUpdateRedisKey() {
    const channel = await this.connectMQ();

    const queue = `${process.env.MODE}_update_redis_key_queue`;
    channel.assertQueue(queue, {
      durable: true,
    });

    channel.consume(
      queue,
      async (msg) => {
        const data = JSON.parse(msg.content.toString());

        // console.log(' [x] Received %s', data, typeof data);
        if (data) {
          const existingKey = Constant.REDIS.userCartKey + data?.cart_uniq_id;
          const newKey = Constant.REDIS.userCartKey + data?.customer_id;
          const existingData = await this.redisService.get(existingKey);
          if (existingData && existingData.length) {
            const ttl = await this.redisService.getTtl(existingKey);
            // set old data in new key
            await this.redisService.set(newKey, existingData, ttl);
            // delete old key
            await this.redisService.del(existingKey);
          }
        }
      },
      {
        noAck: true,
      },
    );
  }
}
