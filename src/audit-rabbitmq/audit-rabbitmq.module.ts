import { Module, Inject } from '@nestjs/common';
import { Transport, ClientsModule } from '@nestjs/microservices';
import { AuditRabbitMQService } from './audit-rabbitmq.service';
import { ClientProxy } from '@nestjs/microservices';
const queueName = `${process.env.MODE}_audit_queue`;
import { LoggerService } from '../logger/logger.service';

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
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [],
  providers: [AuditRabbitMQService, LoggerService],
  exports: [AuditRabbitMQService, AuditRabbitMQModule],
})
export class AuditRabbitMQModule {
  constructor(
    @Inject(`${process.env.MQ_SERVICE_NAME}`) private client: ClientProxy,
  ) {}
}
