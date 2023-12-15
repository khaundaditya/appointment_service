import {
  Controller,
  Get,
  Res,
  HttpStatus,

  // UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ResponseDto } from '../common/dto/response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import {
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { UtilityService } from '../common/libs/utility.service';
import { AuthService } from './auth.service';

@ApiTags('Customer Journey')
@Controller('api/v2')
export class AuthController {
  constructor(
    private readonly utilityService: UtilityService,
    private authService: AuthService,
  ) {}

  @Get('appointment/generateWaitListToken')
  // @UseGuards(RtGuard)
  //@UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Finds waiting list of appointment.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async generateWaitListToken(@Res() res: Response) {
    //return this.authService.refreshTokens( );
    try {
      const token = await this.authService.refreshTokens();
      return res.json(
        this.utilityService.getResponse(
          token,
          'Tokens fetched successfully.',
          HttpStatus.OK,
          true,
        ),
      );
    } catch (err) {
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }
}
