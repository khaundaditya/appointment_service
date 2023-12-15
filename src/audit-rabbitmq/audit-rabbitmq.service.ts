import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateLogDataDto } from './dto/create-log-data.dto';
import { v4 } from 'uuid';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class AuditRabbitMQService {
  constructor(
    @Inject(`${process.env.MQ_SERVICE_NAME}`) private client: ClientProxy,
    private readonly loggerService: LoggerService,
  ) {}

  public logger = this.loggerService.initiateLogger();

  public async emitMqMessages(topic, mqData) {
    return await this.client.emit<any>(topic, mqData);
  }

  public async sendAuditLog(api_request, api_name, log_msg, queue_name) {
    try {
      this.logger.info(`AuditRabbitmqService : Enter sendAuditLog Method`);
      const createLogDataDto = new CreateLogDataDto();
      createLogDataDto.tenant_id =
        api_request && api_request.headers.tenant_id
          ? api_request.headers.tenant_id
          : null;
      createLogDataDto.request_id = v4();
      createLogDataDto.request_url = api_request ? api_request.url : null;
      createLogDataDto.api_name = api_name ? api_name : null;
      createLogDataDto.http_method = api_request ? api_request.method : null;
      createLogDataDto.host = api_request ? api_request.headers.host : null;
      createLogDataDto.logs = log_msg;
      createLogDataDto.queue_name = queue_name;
      createLogDataDto.created_by =
        api_request && api_request.headers.customer_id
          ? api_request.headers.customer_id
          : null;
      await this.emitMqMessages(queue_name, createLogDataDto);
      this.logger.info(`AuditRabbitmqService : Exit sendAuditLog Method`);
      return true;
    } catch (err) {
      this.logger.error(`Error: AuditRabbitmqService: sendAuditLog => ${err}`);
      return false;
    }
  }
}
