import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerUser } from './entities/customer-user.entity';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(CustomerUser)
    private customerUserRepository: Repository<CustomerUser>,
    private readonly loggerService: LoggerService,
  ) {}

  public logger = this.loggerService.initiateLogger();

  async findOne(id: string): Promise<CustomerUser> {
    this.logger.info(`UsersService : Enter findOne Method`);
    const customerUser = await this.customerUserRepository.findOne({
      relations: ['customer_preference'],
      where: [
        {
          id: id,
        },
        {
          cognito_id: id,
        },
      ],
    });
    if (customerUser) {
      this.logger.info(`UsersService : Exit findOne Method`);
      return customerUser;
    }
    throw new HttpException('User not found', HttpStatus.NOT_FOUND);
  }
}
