import { Module, Inject } from '@nestjs/common';
import { Transport, ClientsModule } from '@nestjs/microservices';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { ClientProxy } from '@nestjs/microservices';
const queueName = `${process.env.MODE}_communication_queue`;

@Module({
  imports: [
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
            durable: false,
          },
        },
      },
    ]),
  ],
  controllers: [],
  providers: [RabbitMQService],
  exports: [RabbitMQService, RabbitMQModule],
})
export class RabbitMQModule {
  constructor(
    @Inject(`${process.env.MQ_SERVICE_NAME}`) private client: ClientProxy,
  ) {}
}
