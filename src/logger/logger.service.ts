import { Injectable } from '@nestjs/common';
import { format, transports, createLogger } from 'winston';

@Injectable()
export class LoggerService {
  public transports: any = [];
  constructor() {
    this.transports.push(new transports.Console());
    this.transports.push(
      new transports.File({
        filename: 'logs/combined.log',
        format: format.combine(
          format.timestamp(),
          format.printf(
            (info) => `${info.timestamp} ${info.level}: ${info.message}`,
          ),
        ),
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
