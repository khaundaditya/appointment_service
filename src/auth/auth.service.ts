import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CustomerUser } from '../users/entities/customer-user.entity';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(unique_id: string): Promise<CustomerUser> {
    const customerUser = await this.usersService.findOne(unique_id);
    if (!customerUser) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    return customerUser;
  }

  //   ┬┬ ┬┌┬┐  ┌─┐─┐ ┬┌┬┐┬─┐┌─┐┌─┐┌┬┐┌─┐┬─┐
  //   ││││ │   ├┤ ┌┴┬┘ │ ├┬┘├─┤│   │ │ │├┬┘
  //  └┘└┴┘ ┴   └─┘┴ └─ ┴ ┴└─┴ ┴└─┘ ┴ └─┘┴└─
  private jwtExtractor(request) {
    let token = null;
    if (request.header('x-token')) {
      token = request.get('x-token');
    } else if (request.headers.authorization) {
      token = request.headers.authorization
        .replace('Bearer ', '')
        .replace(' ', '');
    } else if (request.body.token) {
      token = request.body.token.replace(' ', '');
    } else if (request.query.token) {
      token = request.body.token.replace(' ', '');
    }
    return token;
  }

  // ***********************
  // ╔╦╗╔═╗╔╦╗╦ ╦╔═╗╔╦╗╔═╗
  // ║║║║╣  ║ ╠═╣║ ║ ║║╚═╗
  // ╩ ╩╚═╝ ╩ ╩ ╩╚═╝═╩╝╚═╝
  // ***********************
  returnJwtExtractor() {
    return this.jwtExtractor;
  }

  async refreshTokens(): Promise<{}> {
    const tokens = await this.getTokens();

    return tokens;
  }

  async getTokens(): Promise<{}> {
    const jwtPayload: {} = {};

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.SECRETKEY,
        expiresIn: '5m',
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.SECRETKEY,
        expiresIn: '30m',
      }),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }
}
