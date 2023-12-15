import { Injectable } from '@nestjs/common';
import { format, transports, createLogger } from 'winston';
const ecsFormat = require('@elastic/ecs-winston-format');

@Injectable()
export class ECSLoggerService {
  public transports: any = [];
  constructor() {
    this.transports.push(new transports.Console());
    this.transports.push(
      new transports.File({
        filename: 'logs/log.json',
        format: ecsFormat({ convertReqRes: true }),
      }),
    );
  }

  initiateLogger() {
    const LoggerInstance = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json(),
      ),
      transports: this.transports,
    });

    return LoggerInstance;
  }
}
