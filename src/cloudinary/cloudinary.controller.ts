import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CloudinaryService } from './cloudinary.service';
import { ResponseDto } from '../common/dto/response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { LoggerService } from '../logger/logger.service';
import { UtilityService } from '../common/libs/utility.service';
import { Request, Response } from 'express';
import { CloudinaryRequestDto } from './dto/cloudinary.request.dto';
import { CloudinaryDeleteImageRequestDto } from './dto/cloudinary-delete-image.request.dto';

@ApiTags('Cloudinary')
@Controller('api/v2')
export class CloudinaryController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly loggerService: LoggerService,
    private readonly utilityService: UtilityService,
  ) {}
  public logger = this.loggerService.initiateLogger();

  @Post('cloudinary/generateSignature')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Generate Cloudinary Signature' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async generateSignature(
    @Req() req: Request,
    @Res() res: Response,
    @Body() cloudinaryDto: CloudinaryRequestDto,
  ) {
    try {
      const signature = await this.cloudinaryService.generateSignature(
        req.headers,
        cloudinaryDto.req_param,
      );
      return res.json(
        this.utilityService.getResponse(signature, '', HttpStatus.OK),
      );
    } catch (err) {
      this.logger.error(
        `Error: CloudinaryController: ApiBadRequestResponse => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('cloudinary/deleteImage')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Delete Cloudinary Image' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async deleteCloudinaryImage(
    @Req() req: Request,
    @Res() res: Response,
    @Body() cloudinaryDeleteImageDto: CloudinaryDeleteImageRequestDto,
  ) {
    try {
      const deletedImage = await this.cloudinaryService.deleteCloudinaryImage(
        req.headers,
        cloudinaryDeleteImageDto.req_param,
      );

      if (deletedImage['result'] === 'ok') {
        return res.json(
          this.utilityService.getResponse(
            'Image Deleted Successfully',
            '',
            HttpStatus.OK,
          ),
        );
      }

      if (deletedImage['result'] === 'not found') {
        return res
          .status(404)
          .json(
            this.utilityService.getErrorResponse(
              404,
              'Image Resource Not Found',
              '',
            ),
          );
      }
    } catch (err) {
      this.logger.error(
        `Error: CloudinaryController: ApiBadRequestResponse => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('cloudinary/imagedetails')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Delete Cloudinary Image' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getCloudinaryImageDetails(
    @Req() req: Request,
    @Res() res: Response,
    @Query() queryParams: any,
  ) {
    try {
      const imagedetails =
        await this.cloudinaryService.getCloudinaryImageDetails(
          req.headers,
          queryParams,
        );
      return res.json(
        this.utilityService.getResponse(imagedetails, '', HttpStatus.OK),
      );
    } catch (err) {
      this.logger.error(
        `Error: CloudinaryController: ApiBadRequestResponse => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }
}
