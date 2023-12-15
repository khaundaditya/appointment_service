import {
  Controller,
  Get,
  Res,
  Param,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { UtilityService } from '../common/libs/utility.service';
import { ResponseDto } from '../common/dto/response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoggerService } from '../logger/logger.service';
@ApiTags('user')
@Controller('api/v1')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly utilityService: UtilityService,
    private readonly loggerService: LoggerService,
  ) {}

  public logger = this.loggerService.initiateLogger();

  @Get('user/:id')
  @ApiOperation({ summary: 'Find user by ID' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async findOne(@Res() res: Response, @Param('id') id: string) {
    try {
      this.logger.info(`UsersController : Enter findOne Method`);
      const customerUser = await this.usersService.findOne(id);
      this.logger.info(`UsersController : Exit findOne Method`);
      return res.json(
        this.utilityService.getResponse(
          customerUser,
          'Customer User fetched successfully.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(`Error: userController: findOne => ${err}`);
      return res.json(
        this.utilityService.getErrorResponse(err.status, err.message, err),
      );
    }
  }
}
