import { Controller } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { CancelInvoiceRabitMQService } from './invoice-cancel-rabbitmq.service';
import * as amqp from 'amqplib';

@Controller()
export class CancelInvoiceController {
  constructor(
    private cancelInvoiceService: CancelInvoiceRabitMQService,
    private readonly loggerService: LoggerService,
  ) {
    // this.ListenInvoiceCanelQueue();
    this.ListenUpdateAppointmentStatusQueue();
  }

  public logger = this.loggerService.initiateLogger();

  async connectMQ() {
    const url = `${process.env.MQ_PREFIX}://${process.env.MQ_USERNAME}:${process.env.MQ_PASSWORD}@${process.env.MQ_URL}:${process.env.MQ_PORT}`;

    const connection = await amqp.connect(url);

    const channel = await connection.createChannel();

    return channel;
  }

  async ListenInvoiceCanelQueue() {
    const channel = await this.connectMQ();

    const queue = `${process.env.MODE}_invoice_cancel_queue`;
    channel.assertQueue(queue, {
      durable: true,
    });

    channel.consume(
      queue,
      (msg) => {
        const data = JSON.parse(msg.content.toString());

        console.log(' [x] Received %s', data, typeof data);
      },
      {
        noAck: true,
      },
    );
  }

  async ListenUpdateAppointmentStatusQueue() {
    const channel = await this.connectMQ();

    const queue = `${process.env.MODE}_appointment_status_update`;
    channel.assertQueue(queue, {
      durable: true,
    });

    channel.consume(
      queue,
      async (msg) => {
        const data = JSON.parse(msg.content.toString());

        await this.cancelInvoiceService.updateAppointmentStatus(data?.data);
      },
      {
        noAck: true,
      },
    );
  }

  // ?? TODO : update event patterna name
  // @EventPattern('invoice_cancel')
  // async handle(data) {
  //   try {
  //     await this.cancelInvoiceService.updateAppointmentStatus(data);
  //   } catch (error) {
  //     this.logger.error(error);
  //   }
  // }
}
