import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class RabbitMQService {
  constructor(
    @Inject(`${process.env.MQ_SERVICE_NAME}`) private client: ClientProxy,
  ) {}

  public emitMqMessages(topic, mqData) {
    return this.client.emit<any>(topic, mqData);
  }
}
