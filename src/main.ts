import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { warn } from 'console';
import { AppointmentsModule } from './appointments/appointments.module';
import { UsersModule } from './users/users.module';
import { Transport } from '@nestjs/microservices';
import { CancelInvoiceRabbitMqModule } from './invoice-cancel-rabbitmq/invoice-cancel-rabbitmq.module';
import { CustomerJourneyModule } from './v2/customer-journey/customerjourney.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*',
  });
  // ╔═╗╦ ╦╔═╗╔═╗╔═╗╔═╗╦═╗
  // ╚═╗║║║╠═╣║ ╦║ ╦║╣ ╠╦╝
  // ╚═╝╚╩╝╩ ╩╚═╝╚═╝╚═╝╩╚═
  const config = new DocumentBuilder()
    .setTitle('Appointments Swagger')
    .setDescription('The appointments API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    include: [AppointmentsModule, UsersModule, CustomerJourneyModule],
  });
  SwaggerModule.setup('api/v1/appointment/swagger', app, document);

  // create microservice which will listen the MQ
  const queueName = `${process.env.MODE}_invoice_cancel_queue`;
  const MQ = await NestFactory.createMicroservice(CancelInvoiceRabbitMqModule, {
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
  });

  MQ.listen();

  // ╔╦╗╔═╗╔═╗╦╔╗╔╔═╗  ╔═╗╔╗╔╔╦╗  ╦  ╦╔═╗╔╦╗╔═╗╔╗╔  ╔╦╗╔═╗  ╔═╗╔═╗╦═╗╔╦╗
  // ║║║╣ ╠╣ ║║║║║╣    ╠═╣║║║ ║║  ║  ║╚═╗ ║ ║╣ ║║║   ║ ║ ║  ╠═╝║ ║╠╦╝ ║
  // ═╩╝╚═╝╚  ╩╝╚╝╚═╝  ╩ ╩╝╚╝═╩╝  ╩═╝╩╚═╝ ╩ ╚═╝╝╚╝   ╩ ╚═╝  ╩  ╚═╝╩╚═ ╩
  const PORT = process.env.PORT || 3000;
  await app.listen(PORT);
  warn(`APP IS LISTENING TO PORT ${PORT}`);
}
bootstrap();
