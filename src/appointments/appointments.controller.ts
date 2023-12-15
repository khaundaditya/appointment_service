import {
  Controller,
  Post,
  Get,
  Body,
  UsePipes,
  ValidationPipe,
  Req,
  Res,
  HttpStatus,
  UseGuards,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiQuery,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AppointmentsService } from './appointments.service';
import { CutterAvailabilityRequestDto } from './dto/cutter-availability-request.dto';
import { LoggerService } from '../logger/logger.service';
import { UtilityService } from '../common/libs/utility.service';
import { ResponseDto } from '../common/dto/response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddToCartRequestDto } from './dto/add-to-cart-request.dto';
import { AddInstructionRequestDto } from './dto/add-instruction-request.dto';
import { AppointmentConfirmRequestDto } from './dto/appointment-confirm-request.dto';
import { UpdateAppointmentRequest } from './dto/update-appointment-request.dto';
import { UpdateAppointmentServiceRequest } from './dto/update-service-request.dto';
import { WalkOutRequestDto } from './dto/walk-out-request.dto';
import { GetServiceRequestDto } from './dto/service-details-request.dto';
import { AuditRabbitMQService } from '../audit-rabbitmq/audit-rabbitmq.service';
import { AuditMessageEnum } from '../common/enum/audit-message.enum';
import { AddMusicBeveragesRequestDto } from './dto/add-music-beverages-request.dto';
import { CreateSendMessageRequestDto } from './dto/create-send-message-request.dto';
import { Cron } from '@nestjs/schedule';
import { AppointmentEditRequestDto } from './dto/edit-appointment-request.dto';
import { UpdateCartRequestDto } from './dto/update-cart-request.dto';
import { ECSLoggerService } from '../logger/ECSlogger.service';

@ApiTags('appointment')
@Controller('api/v1')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly loggerService: LoggerService,
    private readonly utilityService: UtilityService,
    private readonly auditRabbitMQService: AuditRabbitMQService,
    private readonly ECSloggerService: ECSLoggerService,
  ) {}

  public logger = this.loggerService.initiateLogger();
  public ECSlogger = this.ECSloggerService.initiateLogger();

  @Post('appointment/cutteravailability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Checking cutter availability' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiHeader({
    name: 'customer_id',
    required: false,
    description: 'customer_id',
  })
  async checkingCutteravailability(
    @Req() req: Request,
    @Res() res: Response,
    @Body() cutterAvailabilityRequestDto: CutterAvailabilityRequestDto,
    @Headers('domain_name') domain_name: string,
    @Headers('customer_id') customer_id: string,
    @Headers('tenant_id') tenant_id: string,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter checkingCutteravailability Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter checkingCutteravailability Method`,
      );
      let cutters = [];
      if (
        cutterAvailabilityRequestDto.req_param['req_type'] === 'choose_cutter'
      ) {
        cutters =
          await this.appointmentsService.checkingCutteravailabilityByCutter(
            cutterAvailabilityRequestDto.req_param,
            domain_name,
            customer_id,
            tenant_id,
          );
      } else if (
        cutterAvailabilityRequestDto.req_param['req_type'] ===
        'preferred_by_saloon'
      ) {
        cutters =
          await this.appointmentsService.checkingCutteravailabilityBySaloon(
            cutterAvailabilityRequestDto.req_param,
          );
      }
      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'checking_cutter_availability',
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );
      this.logger.info(
        `AppointmentsController : Exit checkingCutteravailability Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit checkingCutteravailability Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          cutters,
          'Cutters fetched successfully.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: checkingCutteravailability => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: checkingCutteravailability => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/add-to-cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add data into the cart' })
  async addToCart(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('tenant_id') tenant_id: string,
    @Headers('domain_name') domain_name: string,
    @Body() requestDto: AddToCartRequestDto,
  ) {
    try {
      this.logger.info(`AppointmentsController : Enter AddToCart Method`);
      this.ECSlogger.info(`AppointmentsController : Enter AddToCart Method`);

      // set key for the user with all cutters booked
      const userCartData = await this.appointmentsService.addToCart(
        requestDto.req_param,
        req.headers,
      );
      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'add_cutter_to_cart',
        { message: AuditMessageEnum.LOG_CUTTER_ADDED_TO_CART },
        queue_name.toLocaleLowerCase(),
      );
      this.logger.info(`AppointmentsController : Exit AddToCart Method`);
      this.ECSlogger.info(`AppointmentsController : Exit AddToCart Method`);
      return res.json(
        this.utilityService.getResponse(
          [],
          userCartData.message,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(`Error: AppointmentsController: AddToCart => ${err}`);
      this.ECSlogger.error(
        `Error: AppointmentsController: AddToCart => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/remove-from-cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove Data from the cart' })
  async removeFromCart(
    @Res() res: Response,
    @Req() req: Request,
    @Body() requestDto: AddToCartRequestDto,
  ) {
    try {
      this.logger.info(`AppointmentsController : Enter removeFromCart Method`);
      this.ECSlogger.info(
        `AppointmentsController : Enter removeFromCart Method`,
      );

      // set key for the user with all cutters booked
      await this.appointmentsService.removeFromCart(
        requestDto.req_param,
        req.headers,
      );
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'remove_cutter_from_cart',
        { message: AuditMessageEnum.LOG_CUTTER_REMOVED_FROM_CART },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(`AppointmentsController : Exit removeFromCart Method`);
      this.ECSlogger.info(
        `AppointmentsController : Exit removeFromCart Method`,
      );

      return res.json(
        this.utilityService.getResponse(
          [],
          'Cutter removed from cart successfully.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: holdSelectedCutter => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: holdSelectedCutter => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/cart/:id')
  //@UseGuards(JwtAuthGuard)
  //@ApiBearerAuth()
  @ApiOperation({ summary: 'Get cart details' })
  @ApiHeader({
    name: 'tenant_id',
    required: true,
    description: 'Brand/Franchisor Id',
  })
  async getCartDetails(
    @Res() res: Response,
    @Req() req: Request,
    @Param('id') customerId: string,
    @Headers('domain_name') domain_name: string,
  ) {
    try {
      this.logger.info(`AppointmentsController : Enter getCartDetails Method`);
      this.ECSlogger.info(
        `AppointmentsController : Enter getCartDetails Method`,
      );

      // set key for the user with all cutters booked
      const userCartData = await this.appointmentsService.getCartDetails(
        customerId,
        domain_name,
        req.headers,
      );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'get_cart_details',
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(`AppointmentsController : Exit getCartDetails Method`);
      return res.json(
        this.utilityService.getResponse(userCartData, '', HttpStatus.OK),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: holdSelectedCutter => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: holdSelectedCutter => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/fetch-nearby-stores')
  @ApiOperation({ summary: 'Fetch nearby stores.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiQuery({
    name: 'latitude',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'longitude',
    required: true,
    type: String,
  })
  @ApiHeader({
    name: 'tenant_id',
    required: true,
    description: 'Brand/Franchisor Id',
  })
  async fetchNearbyStores(
    @Res() res: Response,
    @Req() req: Request,
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('start') start: number,
    @Query('limit') limit: number,
    @Headers('tenant_id') tenant_id: string,
    @Headers('domain_name') domain_name: string,
    @Headers('customer_id') customer_id: string,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter fetchNearbyStores Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter fetchNearbyStores Method`,
      );

      const paginationObj = {
        skip: start && +start ? +start : 1,
        limit: limit && +limit ? +limit : 10,
      };
      const getNearbyStores = await this.appointmentsService.fetchNearbyStores(
        latitude,
        longitude,
        paginationObj,
        tenant_id,
        domain_name,
        customer_id,
      );
      if (getNearbyStores) {
        // activity log
        const queue_name = `${process.env.MODE}_audit_queue`;
        await this.auditRabbitMQService.sendAuditLog(
          req,
          'fetch_nearbuy_stores',
          { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
          queue_name.toLocaleLowerCase(),
        );

        this.logger.info(
          `AppointmentsController : Exit fetchNearbyStores Method`,
        );
        this.ECSlogger.info(
          `AppointmentsController : Exit fetchNearbyStores Method`,
        );
        return res.json(
          this.utilityService.getResponse(
            { store_details: getNearbyStores.nearbyRecords },
            'Nearby stores are fetched successfully.',
            HttpStatus.OK,
            true,
            getNearbyStores.totalCount,
          ),
        );
      }
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: fetchNearbyStores => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: fetchNearbyStores => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'customer_id',
    description: 'Id of the logged in customer',
  })
  @ApiHeader({
    name: 'tenant_id',
    description: 'Brand id',
  })
  @ApiHeader({
    name: 'domain_name',
    description: 'Brand name',
  })
  @ApiHeader({
    name: 'device_type',
    description: 'web/android/ios/kiosk',
  })
  @ApiOperation({ summary: 'Confirm appointment slot' })
  async createAppointment(
    @Res() res: Response,
    @Req() req: Request,
    @Body() requestDto: AppointmentConfirmRequestDto,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter createAppointment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter createAppointment Method`,
      );

      const createdAppointment =
        await this.appointmentsService.confirmAppointment(
          req.headers,
          requestDto.req_param,
        );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'book_appointment',
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(
        `AppointmentsController : Exit createAppointment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit createAppointment Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          {
            appointments: createdAppointment.data,
            totalAmountPaid: createdAppointment.totalAmountPaid,
          },
          createdAppointment.message,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: createAppointment => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: createAppointment => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/cancellation-policy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get cancellation policy URL' })
  async getCancellationUrl(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('domain_name') domain_name: string,
    @Headers('tenant_id') tenant_id: string,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter getCancellationUrl Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter getCancellationUrl Method`,
      );

      const signedUrl = await this.appointmentsService.getCancellationPolicy(
        domain_name,
        tenant_id,
      );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'get_cancellation_policy',
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(
        `AppointmentsController : Exit getCancellationUrl Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit getCancellationUrl Method`,
      );

      return res.json(
        this.utilityService.getResponse(
          { policy_url: signedUrl },
          '',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: getCancellationUrl => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: getCancellationUrl => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('/appointment/cutter-wise')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch all appointment cutter-wise' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiHeader({
    name: 'domain_name',
    required: true,
    description: 'domain_name',
  })
  @ApiHeader({
    name: 'tenant_id',
    required: false,
    description: 'tenant_id',
  })
  @ApiQuery({
    name: 'store_id',
    type: String,
    description: 'store_id',
    required: true,
  })
  @ApiQuery({
    name: 'date',
    type: String,
    description: 'date',
    required: true,
  })
  async fetchAllAppointmnetCutterwise(
    @Headers('tenant_id') tenant_id: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter fetchAllAppointmnetCutterwise Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter fetchAllAppointmnetCutterwise Method`,
      );

      const allAppointments =
        await this.appointmentsService.getAppoinmentCutterWise(req);

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'get_cutterwise_appointment',
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      return res.json(
        this.utilityService.getResponse(allAppointments, '', HttpStatus.OK),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: fetchAllAppointmnetCutterwise => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: fetchAllAppointmnetCutterwise => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('/appointment/employee-wise')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch all appointment employee-wise' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiHeader({
    name: 'tenant_id',
    required: false,
    description: 'tenant_id',
  })
  async fetchAllAppointmnetForEmployee(
    @Headers('tenant_id') tenant_id: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter fetchAllAppointmnetCutterwise Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter fetchAllAppointmnetCutterwise Method`,
      );

      const allAppointments =
        await this.appointmentsService.getAppoinmentEmployeeWise(req);

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'get_employeewise_appointment',
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      return res.json(
        this.utilityService.getResponse(allAppointments, '', HttpStatus.OK),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: fetchAllAppointmnetCutterwise => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: fetchAllAppointmnetCutterwise => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get one appointment.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiQuery({
    name: 'appointment_service_id',
    type: String,
    description: 'appointment_service_id',
    required: false,
  })
  @ApiQuery({
    name: 'tenant_id',
    type: String,
    description: 'tenant_id',
    required: false,
  })
  async findOneAppointment(
    @Res() res: Response,
    @Req() req: Request,
    @Param('id') id: string,
    @Headers('domain_name') domain_name: string,
    @Headers('tenant_id') tenant_id: string,
    @Query('appointment_service_id') appointment_service_id: string,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter findOneAppointment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter findOneAppointment Method`,
      );
      const appointment = await this.appointmentsService.findOneAppointment(
        id,
        domain_name,
        appointment_service_id,
        tenant_id,
      );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'get_appointment_detail',
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(
        `AppointmentsController : Exit findOneAppointment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit findOneAppointment Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          appointment,
          'Appointment fetched successfully.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: findOneAppointment => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: findOneAppointment => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointments/:filter')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finds appointments.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiHeader({
    name: 'guest_user_id',
    required: false,
    description: 'guest_user_id',
  })
  @ApiQuery({
    name: 'date',
    type: String,
    description: 'date',
    required: false,
  })
  @ApiQuery({
    name: 'cutterId',
    type: String,
    description: 'cutterId',
    required: false,
  })
  async findAppointments(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('customer_id') customer_id: string,
    @Headers('guest_user_id') guest_user_id: string,
    @Headers('tenant_id') tenant_id: string,
    @Headers('domain_name') domain_name: string,
    @Param('filter') filter: string,
    @Query('start') start: number,
    @Query('limit') limit: number,
    @Query('date') date?: string,
    @Query('cutterId') cutterId?: string,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter findAppointments Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter findAppointments Method`,
      );

      const paginationObj = {
        skip: start || 1,
        limit: limit || 10,
      };

      let appointments = [];
      if (filter === 'previous') {
        appointments = await this.appointmentsService.findPreviousAppointments(
          customer_id,
          paginationObj,
          date,
          domain_name,
          tenant_id,
        );
      } else if (filter === 'upcoming') {
        appointments = await this.appointmentsService.findUpcomingAppointments(
          customer_id,
          paginationObj,
          date,
          domain_name,
          tenant_id,
        );
      } else {
        appointments = await this.appointmentsService.findAllAppointment(
          customer_id,
          paginationObj,
          date,
          cutterId,
          guest_user_id,
          tenant_id,
          domain_name,
        );
      }

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `get_${filter}_appointment_list`,
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(`AppointmentsController : Exit findAppointments Method`);
      this.ECSlogger.info(
        `AppointmentsController : Exit findAppointments Method`,
      );

      return res.json(
        this.utilityService.getResponse(
          appointments['appointments'],
          'Appointments fetched successfully.',
          HttpStatus.OK,
          true,
          appointments['totalCount'],
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: findAppointments => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/add-instruction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add instruction before booking an appointment' })
  async AddInstruction(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('customer_id') customer_id: string,
    @Headers('guest_user_id') guest_user_id: string,
    @Body() requestDto: AddInstructionRequestDto,
  ) {
    try {
      this.logger.info(`AppointmentsController : Enter AddInstruction Method`);
      this.ECSlogger.info(
        `AppointmentsController : Enter AddInstruction Method`,
      );

      // set key for the user with all cutters booked
      const addInstruction = await this.appointmentsService.addInstruction(
        requestDto.req_param,
        customer_id,
        guest_user_id,
      );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `add_instruction`,
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(`AppointmentsController : Exit AddInstruction Method`);
      this.ECSlogger.info(
        `AppointmentsController : Exit AddInstruction Method`,
      );

      return res.json(
        this.utilityService.getResponse(
          [],
          addInstruction.message,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: AddInstruction => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: AddInstruction => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/add-music-beverages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add Music and beverages on checkout screen' })
  async AddMusicBeverages(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('customer_id') customer_id: string,
    @Headers('guest_user_id') guest_user_id: string,
    @Body() requestDto: AddMusicBeveragesRequestDto,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter AddMusicBeverages Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter AddMusicBeverages Method`,
      );

      // set key for the user with all cutters booked
      const addInstruction =
        await this.appointmentsService.addMusicAndBeverages(
          requestDto.req_param,
          customer_id,
          guest_user_id,
          req.headers,
        );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `add_music_beverages`,
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(
        `AppointmentsController : Exit AddMusicBeverages Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit AddMusicBeverages Method`,
      );

      return res.json(
        this.utilityService.getResponse(
          [],
          addInstruction.message,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: AddMusicBeverages => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: AddMusicBeverages => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/update')
  //@UseGuards(JwtAuthGuard)
  //@ApiBearerAuth()
  @ApiOperation({ summary: 'Update appointment' })
  async appointmentUpdate(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('tenant_id') tenant_id: string,
    @Headers('domain_name') domain_name: string,
    @Body() requestDto: UpdateAppointmentRequest,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter appointmentUpdate Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter appointmentUpdate Method`,
      );

      // set key for the user with all cutters booked
      const appointmentUpdate =
        await this.appointmentsService.appointmentUpdate(
          requestDto.req_param,
          tenant_id,
          domain_name,
        );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `update_appointment`,
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(
        `AppointmentsController : Exit appointmentUpdate Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit appointmentUpdate Method`,
      );

      return res.json(
        this.utilityService.getResponse(
          [],
          appointmentUpdate.message,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: appointmentUpdate => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: appointmentUpdate => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/service/update')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update appointment service' })
  async appointmentServiceUpdate(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('customer_id') customer_id: string,
    @Body() requestDto: UpdateAppointmentServiceRequest,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter appointmentServiceUpdate Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter appointmentServiceUpdate Method`,
      );

      // set key for the user with all cutters booked
      const appointmentUpdate =
        await this.appointmentsService.appointmentServiceUpdate(
          requestDto.req_param,
        );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `update_appointment_service`,
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(
        `AppointmentsController : Exit appointmentServiceUpdate Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          appointmentUpdate.response,
          appointmentUpdate.message,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: appointmentServiceUpdate => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: appointmentServiceUpdate => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/service/add')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add Service to existing appointment.' })
  async addServiceToExistingAppoingment(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('customer_id') customer_id: string,
    @Headers('tenant_id') tenant_id: string,
    @Headers('guest_user_id') guest_user_id: string,
    @Body() requestDto: AddToCartRequestDto,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter addServiceToExistingAppoingment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter addServiceToExistingAppoingment Method`,
      );
      // set key for the user with all cutters booked
      const appointmentUpdate =
        await this.appointmentsService.addServiceToExistingAppoingment(
          requestDto.req_param,
          customer_id,
          tenant_id,
          guest_user_id,
          req.headers,
        );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `add_service_appointment`,
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(
        `AppointmentsController : Exit addServiceToExistingAppoingment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit addServiceToExistingAppoingment Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          [],
          appointmentUpdate.message,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: addServiceToExistingAppoingment => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: addServiceToExistingAppoingment => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/customer/walk-out')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add walk out details of customer' })
  async addToWalkOut(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('customer_id') customer_id: string,
    @Body() requestDto: WalkOutRequestDto,
  ) {
    try {
      this.logger.info(`AppointmentsController : Enter addToWalkOut Method`);
      this.ECSlogger.info(`AppointmentsController : Enter addToWalkOut Method`);
      // set key for the user with all cutters booked
      const appointmentUpdate = await this.appointmentsService.addToWalkOut(
        requestDto.req_param,
      );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `add_to_walkout`,
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(`AppointmentsController : Exit addToWalkOut Method`);
      this.ECSlogger.info(`AppointmentsController : Exit addToWalkOut Method`);

      return res.json(
        this.utilityService.getResponse(
          [],
          appointmentUpdate.message,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: addToWalkOut => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/store/employee/today')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
  })
  @ApiOperation({
    summary: "Fetch a store cutter/employee today's appointments",
  })
  async fetchStoreEmployeeTodayAppointments(
    @Res() res: Response,
    @Headers('employee_user_id') employee_user_id: string,
    @Query('date') date: string,
    @Query('start') start: number,
    @Query('limit') limit: number,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter fetchStoreEmployeeTodayAppointments Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter fetchStoreEmployeeTodayAppointments Method`,
      );
      const paginationObj = {
        skip: start || 1,
        limit: limit || 10,
      };
      const fetchTodayAppointments =
        await this.appointmentsService.fetchStoreEmployeeTodayAppointments(
          employee_user_id,
          date,
          paginationObj,
        );
      if (fetchTodayAppointments) {
        this.logger.info(
          `AppointmentsController : Exit fetchStoreEmployeeTodayAppointments Method`,
        );
        this.ECSlogger.info(
          `AppointmentsController : Exit fetchStoreEmployeeTodayAppointments Method`,
        );

        return res.json(
          this.utilityService.getResponse(
            {
              employee_details: fetchTodayAppointments.employee_details[0]
                ? fetchTodayAppointments.employee_details[0]
                : {},
              appointment_details: fetchTodayAppointments.sortedTodayAppointment
                ? fetchTodayAppointments.sortedTodayAppointment
                : [],
            },
            'Details are fetched successfully.',
            HttpStatus.OK,
            true,
            fetchTodayAppointments.sortedTodayAppointment.length,
          ),
        );
      }
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: fetchStoreEmployeeTodayAppointments => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: fetchStoreEmployeeTodayAppointments => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/employee/today')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
  })
  @ApiOperation({ summary: "Fetch a cutter/employee today's appointments" })
  async fetchEmployeeTodayAppointments(
    @Res() res: Response,
    @Headers('employee_user_id') employee_user_id: string,
    @Query('date') date: string,
    @Query('start') start: number,
    @Query('limit') limit: number,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter fetchTodayAppointments Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter fetchTodayAppointments Method`,
      );
      const paginationObj = {
        skip: start || 1,
        limit: limit || 10,
      };
      const fetchTodayAppointments =
        await this.appointmentsService.fetchEmployeeTodayAppointments(
          employee_user_id,
          date,
          paginationObj,
        );
      if (fetchTodayAppointments) {
        this.logger.info(
          `AppointmentsController : Exit fetchTodayAppointments Method`,
        );
        this.ECSlogger.info(
          `AppointmentsController : Exit fetchTodayAppointments Method`,
        );
        return res.json(
          this.utilityService.getResponse(
            {
              appointment_details: fetchTodayAppointments
                ? fetchTodayAppointments
                : [],
            },
            'Details are fetched successfully.',
            HttpStatus.OK,
            true,
            fetchTodayAppointments.length,
          ),
        );
      }
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: fetchTodayAppointments => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: fetchTodayAppointments => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/service/details')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get services details of customer' })
  async getServiceDetails(
    @Res() res: Response,
    @Body() requestDto: GetServiceRequestDto,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter services details Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter services details Method`,
      );

      // set key for the user with all cutters booked
      const serviceDetails = await this.appointmentsService.getServiceDetails(
        requestDto.req_param,
      );

      this.logger.info(`AppointmentsController : Exit services details Method`);
      this.ECSlogger.info(
        `AppointmentsController : Exit services details Method`,
      );

      return res.json(
        this.utilityService.getResponse(
          serviceDetails.details,
          serviceDetails.message,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: services details => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/aws-secrets-manager')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finds aws secrets manager.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async findAllAWSSecretsManager(
    @Headers('domain_name') domain_name: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter findAllAWSSecretsManager Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter findAllAWSSecretsManager Method`,
      );

      const AWSSecretsManager =
        await this.appointmentsService.findAllAWSSecretsManager(domain_name);
      const resJson = this.utilityService.getResponse(
        AWSSecretsManager,
        'AWS Secrets Manager fetched successfully.',
        HttpStatus.OK,
      );
      this.logger.info(
        `AppointmentsController : Exit findAllAWSSecretsManager Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit findAllAWSSecretsManager Method`,
      );
      return res.json(resJson);
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: findAllAWSSecretsManager => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: findAllAWSSecretsManager => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/service/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get TTL for appointment service' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getTtlOfAppointmentService(
    @Res() res: Response,
    @Param('id') appointment_service_id: string,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter getTtlOfAppointmentService Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter getTtlOfAppointmentService Method`,
      );
      const response =
        await this.appointmentsService.getTtlOfAppointmentService(
          appointment_service_id,
        );
      const resJson = this.utilityService.getResponse(
        response,
        'Appointment ttl fetched successfully.',
        HttpStatus.OK,
      );
      this.logger.info(
        `AppointmentsController : Exit getTtlOfAppointmentService Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit getTtlOfAppointmentService Method`,
      );
      return res.json(resJson);
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: findAllAWSSecretsManager => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: findAllAWSSecretsManager => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/cutter/:cutter_id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get cutter's appointment" })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiParam({
    name: 'cutter_id',
    type: String,
  })
  @ApiHeader({
    name: 'domain_name',
    required: true,
    description: 'domain_name',
  })
  @ApiHeader({
    name: 'tenant_id',
    required: false,
    description: 'tenant_id',
  })
  @ApiQuery({
    name: 'date',
    type: String,
    description: 'date',
    required: true,
  })
  @ApiQuery({
    name: 'store_id',
    type: String,
    description: 'store_id',
    required: true,
  })
  async getCuttersAppointment(@Req() req: Request, @Res() res: Response) {
    try {
      this.logger.info(
        `AppointmentsController : Enter getCuttersAppointment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter getCuttersAppointment Method`,
      );
      const response = await this.appointmentsService.getCuttersAppointment(
        req,
      );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `get_cutter_appointment`,
        { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
        queue_name.toLocaleLowerCase(),
      );

      const resJson = this.utilityService.getResponse(
        response,
        'Appointment details fetched successfully.',
        HttpStatus.OK,
      );
      this.logger.info(
        `AppointmentsController : Exit getCuttersAppointment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit getCuttersAppointment Method`,
      );
      return res.json(resJson);
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: getCuttersAppointment => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: getCuttersAppointment => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/send/message')
  @ApiOperation({ summary: 'Send message.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async sendMessage(
    @Req() req: Request,
    @Res() res: Response,
    @Body() requestDto: CreateSendMessageRequestDto,
  ) {
    try {
      this.logger.info(`AppointmentsController : Enter sendMessage Method`);
      this.ECSlogger.info(`AppointmentsController : Enter sendMessage Method`);
      const response = await this.appointmentsService.sendMessage(
        requestDto.req_param,
      );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `send_message`,
        { message: AuditMessageEnum.LOG_SEND_MESSAGE },
        queue_name.toLocaleLowerCase(),
      );

      const resJson = this.utilityService.getResponse(
        response,
        'Message sent successfully.',
        HttpStatus.OK,
      );
      this.logger.info(`AppointmentsController : Exit sendMessage Method`);
      this.ECSlogger.info(`AppointmentsController : Exit sendMessage Method`);
      return res.json(resJson);
    } catch (err) {
      this.logger.error(`Error: AppointmentsController: sendMessage => ${err}`);
      this.ECSlogger.error(
        `Error: AppointmentsController: sendMessage => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/status')
  @ApiOperation({ summary: 'Appointment Status.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async appointmentStatus(@Res() res: Response) {
    try {
      this.logger.info(
        `AppointmentsController : Enter appointmentStatus Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter appointmentStatus Method`,
      );
      const sent = await this.appointmentsService.appointmentStatus();
      this.logger.info(
        `CommunicationsController : Exit appointmentStatus Method`,
      );
      this.ECSlogger.info(
        `CommunicationsController : Exit appointmentStatus Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          sent,
          'Appointment Status sent successfully.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: appointmentStatus => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: appointmentStatus => ${err}`,
      );
      return res.json(
        this.utilityService.getErrorResponse(err.status, err.message, err),
      );
    }
  }

  @Cron('0 */1 * * * *')
  async handleAppointmentStatus() {
    try {
      this.logger.info(
        `AppointmentsController : Enter handleAppointmentStatus Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter handleAppointmentStatus Method`,
      );
      const status = await this.appointmentsService.handleAppointmentStatus();
      this.logger.info(
        `AppointmentsController : handleSendNotificationReminder : send : ${JSON.stringify(
          status,
        )}`,
      );
      this.logger.info(
        `AppointmentsController : Exit handleAppointmentStatus Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit handleAppointmentStatus Method`,
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: handleAppointmentStatus => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: handleAppointmentStatus => ${err}`,
      );
    }
  }

  @Post('appointment/edit')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Edit booked appointment' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async editAppointment(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('customer_id') customer_id: string,
    @Headers('domain_name') domain_name: string,
    @Headers('tenant_id') tenant_id: string,
    @Body() editAppointmenRequestDto: AppointmentEditRequestDto,
  ) {
    try {
      this.logger.info(`AppointmentsController : Enter editAppointment Method`);
      this.ECSlogger.info(
        `AppointmentsController : Enter editAppointment Method`,
      );
      const editAppointmentDto = editAppointmenRequestDto.req_param;
      editAppointmentDto.customer_id = customer_id;
      editAppointmentDto.domain_name = domain_name;
      editAppointmentDto.tenant_id = tenant_id;
      const appointment = await this.appointmentsService.editAppointment(
        editAppointmentDto,
      );
      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `edit_appointment`,
        { message: AuditMessageEnum.EDIT_APPOINTMENT },
        queue_name.toLocaleLowerCase(),
      );
      this.logger.info(`AppointmentsController : Exit editAppointment Method`);
      this.ECSlogger.info(
        `AppointmentsController : Exit editAppointment Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          appointment,
          'Appointment added in the cart.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: editAppointment => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: editAppointment => ${err}`,
      );
      const resJson = this.utilityService.getErrorResponse(
        err.status,
        err.message,
        err,
      );
      resJson.error['error_type'] = err.error_type;
      return res.status(400).json(resJson);
    }
  }

  @Post('appointment/update/cart')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Update cart details' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async updateCartDetails(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('customer_id') customer_id: string,
    @Headers('tenant_id') tenant_id: string,
    @Body() updateCartDto: UpdateCartRequestDto,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter updateCartDetails Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Enter updateCartDetails Method`,
      );

      const editAppointmentDto = updateCartDto.req_param;
      editAppointmentDto.customer_id = customer_id;
      editAppointmentDto.tenant_id = tenant_id;
      const data = await this.appointmentsService.updateCartDetails(
        editAppointmentDto,
      );
      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'update_time_and_cutter_to_cart',
        { message: AuditMessageEnum.LOG_TIME_CUTTER_UPDATED_TO_CART },
        queue_name.toLocaleLowerCase(),
      );
      this.logger.info(
        `AppointmentsController : Exit updateCartDetails Method`,
      );
      this.ECSlogger.info(
        `AppointmentsController : Exit updateCartDetails Method`,
      );
      return res.json(this.utilityService.getResponse(data, '', HttpStatus.OK));
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: updateCartDetails => ${err}`,
      );
      this.ECSlogger.error(
        `Error: AppointmentsController: updateCartDetails => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }
}
