import { Injectable, UnauthorizedException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user): any {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) {
      const res = {
        error: {
          error_code: HttpStatus.UNAUTHORIZED,
          error_message: 'Unauthorized-Invalid token',
          actual_error: 'Unauthorized-Invalid token',
        },
      };
      throw new UnauthorizedException(res);
    }
    return true;
  }
}
