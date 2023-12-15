import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  HttpStatus,
  Body,
  UsePipes,
  ValidationPipe,
  Headers,
  Query,
  Param,
  UseGuards,
  // UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ResponseDto } from '../../common/dto/response.dto';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetStoresQueryDto } from './dto/getstoresquery.dto';
import {
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiQuery,
  ApiHeader,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LoggerService } from '../../logger/logger.service';
import { CustomerJourneyService } from './customerjourney.service';
import { UtilityService } from '../../common/libs/utility.service';
import { Language } from '../../common/language/en';
import { CutterSlotsRequestDto } from './dto/cutter-slots.request.dto';
import { CJAddToCartRequestDto } from './dto/add-to-cart-request.dto';
import { UpdateCartRequestDto } from './dto/update-cart-request.dto';
import { CJAddInstructionRequestDto } from './dto/add-instruction-request.dto';
import { CJAppointmentConfirmRequestDto } from './dto/confirm-appointment-request.dto';
import { CJCancellationPoilcyRequestDto } from './dto/cancellation-policy-request.dto';
import { CJRemoveCartRequestDto } from './dto/remove-cart-request.dto';
import { UpdateRediskKeyRequestDto } from './dto/update-redis-key-request.dto';
import { AppointmentDto } from './dto/appointment.dto';
import { AuditRabbitMQService } from '../../audit-rabbitmq/audit-rabbitmq.service';
import { AuditMessageEnum } from '../../common/enum/audit-message.enum';
import { UpdateAppointmentRequest } from '../../appointments/dto/update-appointment-request.dto';
import { CJClearSlotsRequestDto } from './dto/clear-slots-request.dto';
import { CJAppointmentEditRequestDto } from './dto/edit-appointment-request.dto';
import { CJAddGuestRequestDto } from './dto/add-guest.request.dto';
import { CJAppointmentEditDto } from './dto/edit-appointment.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AppointmentServiceDto } from '../../appointments/dto/appointment-service.dto';
import { ECSLoggerService } from '../../logger/ECSlogger.service';

@ApiTags('Customer Journey')
@Controller('api/v2')
export class CustomerJourneyController {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly customerJourneyService: CustomerJourneyService,
    private readonly utilityService: UtilityService,
    private readonly auditRabbitMQService: AuditRabbitMQService,
    private readonly ECSloggerService: ECSLoggerService,
  ) {}

  public logger = this.loggerService.initiateLogger();
  public ECSlogger = this.ECSloggerService.initiateLogger();

  @Get('appointment/flagship-services')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Fetch the list of flagship services for carasoul' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiOperation({
    summary: 'Fetch a store and service details for Carousel',
  })
  @ApiQuery({
    name: 'city',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'long',
    required: false,
    type: String,
  })
  async getCarasoulServices(
    @Res() res: Response,
    @Headers('domain_name') domain_name: string,
    @Headers('tenant_id') tenant_id: string,
    @Query() queryParams: GetStoresQueryDto,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyController : getCarasoulServices Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyController : getCarasoulServices Method`,
      );
      const data = await this.customerJourneyService.getCarasoulServices(
        queryParams,
        domain_name,
        tenant_id,
      );
      return res.json(
        this.utilityService.getResponse(
          { data },
          Language.SUCESS.MSG_CARASOUL_SERVICE,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneyController: getCarasoulServices => ${err}`,
      );
      this.ECSlogger.error(
        `Error: CustomerJourneyController: getCarasoulServices => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/cutteravailability')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Fetch available time slots' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiHeader({
    name: 'tenant_id',
    description: 'tenant_id',
    required: true,
  })
  @ApiHeader({
    name: 'domain_name',
    description: 'domain_name',
    required: true,
  })
  @ApiHeader({
    name: 'customer_id',
    description: 'customer_id',
  })
  @ApiHeader({
    name: 'guest_user_id',
    description: 'guest_user_id',
    required: false,
  })
  @ApiQuery({
    name: 'start',
    description: 'start',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'limit',
    required: false,
  })
  async getAvailableSlots(
    @Res() res: Response,
    @Req() req: Request,
    @Body() cutterSlotsDto: CutterSlotsRequestDto,
    @Query('start') start: number,
    @Query('limit') limit: number,
  ) {
    try {
      const paginationObj = {
        skip: start || 1,
        limit: limit || 10,
      };
      const data = await this.customerJourneyService.getAvailableSlots1(
        req,
        cutterSlotsDto.req_param,
        paginationObj,
      );
      return res.json(
        this.utilityService.getResponse(
          data,
          Language.SUCESS.MSG_AVAILABLE_SLOTS,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneyController: getAvailableSlots => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/add-to-cart')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Add to cart api' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiHeader({
    name: 'tenant_id',
    description: 'tenant_id',
  })
  @ApiHeader({
    name: 'domain_name',
    description: 'domain_name',
  })
  @ApiHeader({
    name: 'customer_id',
    description: 'customer_id',
  })
  @ApiHeader({
    name: 'guest_user_id',
    description: 'guest_user_id',
  })
  async addToCart(
    @Res() res: Response,
    @Req() req: Request,
    @Body() addToCartDto: CJAddToCartRequestDto,
  ) {
    try {
      const data = await this.customerJourneyService.addToCart(
        req.headers,
        addToCartDto.req_param,
      );

      if (!data['cart_uniq_id']) {
        return res.status(400).json({
          error: {
            status: false,
            error_type: data['error_type'],
            error_message: data['error_message'],
            actual_error: {},
          },
        });
      } else {
        return res.json(
          this.utilityService.getResponse(
            data,
            Language.SUCESS.MSG_SERVICE_ADD_CART,
            HttpStatus.OK,
          ),
        );
      }
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneyController: AddToCart => ${err}`,
      );

      // TODO:: show_popup: 0/1, message: 'Will reset your previous slot. Do you want to continue?'
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/cart/:id')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Get cart details' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiHeader({
    name: 'tenant_id',
    description: 'Brand id',
  })
  @ApiHeader({
    name: 'domain_name',
    description: 'Brand name',
  })
  async getCartDetails(
    @Res() res: Response,
    @Req() req: Request,
    @Param('id') customerId: string,
  ) {
    try {
      const data = await this.customerJourneyService.getCartDetails(
        req.headers,
        customerId,
      );
      return res.json(
        this.utilityService.getResponse(
          data,
          Language.SUCESS.MSG_GET_CART_DETAILS,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneyController: AddToCart => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
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
    @Body() updateCartDto: UpdateCartRequestDto,
  ) {
    try {
      const data = await this.customerJourneyService.updateCartDetails(
        req,
        updateCartDto.req_param,
      );
      return res.json(
        this.utilityService.getResponse(
          data,
          Language.SUCESS.MSG_UPDATE_CART_DETAILS,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneyController: AddToCart => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/store-detail/:id')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Get store details' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getStoreDetails(
    @Res() res: Response,
    @Req() req: Request,
    @Param('id') storeId: string,
    @Query() queryParams: any,
  ) {
    try {
      const data = await this.customerJourneyService.getStoreDetailAPI(
        storeId,
        req.headers,
        queryParams,
      );
      return res.json(
        this.utilityService.getResponse(
          data,
          Language.SUCESS.MSG_UPDATE_CART_DETAILS,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneyController: AddToCart => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/add-instrcution')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Add instruction in cart' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async addInstruction(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('customer_id') customer_id: string,
    @Headers('guest_user_id') guest_user_id: string,
    @Body() addInstructionRequestDto: CJAddInstructionRequestDto,
  ) {
    try {
      await this.customerJourneyService.addInstruction(
        addInstructionRequestDto.req_param,
        customer_id,
        guest_user_id,
      );
      return res.json(
        this.utilityService.getResponse(
          [],
          Language.SUCESS.MSG_INSTRUCTION_ADD,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneyController: ApiBadRequestResponse => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/cancellation-policy')
  @ApiOperation({ summary: 'Get cancellation policy URL' })
  async getCancellationUrl(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('domain_name') domain_name: string,
    @Headers('tenant_id') tenant_id: string,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyController : Enter getCancellationUrl Method`,
      );
      const signedUrl = await this.customerJourneyService.getCancellationPolicy(
        domain_name,
        tenant_id,
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
        `Error: CustomerJourneyController: getCancellationUrl => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/insert/cancel-policy')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Get cancellation policy details' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async insertpolicyAcceptDetails(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('domain_name') domain_name: string,
    @Body() CancellationPolicyDto: CJCancellationPoilcyRequestDto,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyController : Enter insertpolicyAcceptDetails Method`,
      );
      // set key for the user with all cutters booked
      await this.customerJourneyService.acceptCancellationPolicy(
        CancellationPolicyDto.req_param,
      );

      return res.json(
        this.utilityService.getResponse(
          [],
          'Cancellation policy successfully accepted.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneyController: insertpolicyAcceptDetails => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/remove-from-cart')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Remove item form the cart api' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async removeToCart(
    @Res() res: Response,
    @Req() req: Request,
    @Body() removeToCartDto: CJRemoveCartRequestDto,
  ) {
    try {
      this.logger.info(`CustomerJourneyController : Enter removeToCart Method`);
      const removeStatus = await this.customerJourneyService.removeCartDetails(
        removeToCartDto.req_param,
        req.headers,
      );

      if (removeStatus) {
        return res.status(400).json({
          error: {
            status: false,
            error_type: removeStatus['error_type'],
            error_message: removeStatus['error_message'],
            actual_error: {},
          },
        });
      } else {
        return res.json(
          this.utilityService.getResponse(
            [],
            Language.SUCESS.MSG_CART_REMOVE,
            HttpStatus.OK,
          ),
        );
      }
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneyController: removeToCart => ${err}`,
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
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Book appointment' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiHeader({
    name: 'customer_id',
    required: false,
    description: 'customer_id',
  })
  @ApiHeader({
    name: 'guest_user_id',
    required: false,
    description: 'guest_user_id',
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
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async confirmAppointment(
    @Res() res: Response,
    @Req() req: Request,
    @Body() confrimAppointmentDto: CJAppointmentConfirmRequestDto,
  ) {
    try {
      this.logger.info(
        `CustomerJourneycontroller : Enter confirmAppointment Method`,
      );

      const data = await this.customerJourneyService.confirmAppointment(
        req.headers,
        confrimAppointmentDto.req_param,
      );

      if (data['error_type']) {
        return res.status(400).json({
          error: {
            status: false,
            error_type: data['error_type'],
            error_message: data['error_message'],
            service_id: data['service_id'],
            actual_error: {},
          },
        });
      }
      this.logger.info(
        `CustomerJourneycontroller : Exit confirmAppointment Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          data,
          Language.SUCESS.MSG_BOOK_APPOINTMENT,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneycontroller: confirmAppointment => ${err}`,
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
    type: Number,
  })
  @ApiQuery({
    name: 'longitude',
    required: true,
    type: Number,
  })
  @ApiHeader({
    name: 'tenant_id',
    required: true,
    description: 'Brand/Franchisor Id',
  })
  @ApiQuery({
    name: 'show_time_to_reach',
    required: false,
    description: 'show_time_to_reach',
  })
  async fetchNearbyStores(
    @Res() res: Response,
    @Req() req: Request,
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('start') start: number,
    @Query('limit') limit: number,
    @Query('show_time_to_reach') show_time_to_reach: string,
    @Headers('tenant_id') tenant_id: string,
    @Headers('domain_name') domain_name: string,
    @Headers('customer_id') customer_id: string,
  ) {
    try {
      this.logger.info(
        `CustomerJourneycontroller : Enter fetchNearbyStores Method`,
      );

      const paginationObj = {
        skip: start && +start ? +start : 1,
        limit: limit && +limit ? +limit : 10,
      };

      const getNearbyStores =
        await this.customerJourneyService.fetchNearbyStores(
          latitude,
          longitude,
          paginationObj,
          tenant_id,
          domain_name,
          customer_id,
          req.headers,
          show_time_to_reach,
        );
      if (getNearbyStores) {
        // activity log
        /* const queue_name = `${process.env.MODE}_audit_queue`;
        await this.auditRabbitMQService.sendAuditLog(
          req,
          'fetch_nearbuy_stores',
          { message: AuditMessageEnum.LOG_FETCH_CUTTER_AVAILABILITY },
          queue_name.toLocaleLowerCase(),
        );*/

        this.logger.info(
          `CustomerJourneycontroller : Exit fetchNearbyStores Method`,
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
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/update-redis-key')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'To update the redis cart key' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async updateRedisKey(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('tenant_id') tenant_id: string,
    @Body() updateRedisKeyRequestDto: UpdateRediskKeyRequestDto,
  ) {
    try {
      this.logger.info(
        `CustomerJourneycontroller : Enter updateRedisKey Method`,
      );

      await this.customerJourneyService.updateRedisKey(
        updateRedisKeyRequestDto.req_param,
        tenant_id,
      );

      this.logger.info(
        `CustomerJourneycontroller : Exit updateRedisKey Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          '',
          Language.SUCESS.MSG_REIDS_KEY_UPDATE,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneycontroller: updateRedisKey => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/appointmentWaitList')
  @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Finds waiting list of appointment.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async appointmentWaitList(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('domain_name') domain_name: string,
    @Headers('tenant_id') tenant_id: string,
    @Query('store_id') store_id: string,
    @Query('pin') pin: string,
  ) {
    try {
      this.logger.info(
        `CustomerJourneycontroller : Enter appointment waiting Method`,
      );

      const appointmentDto = new AppointmentServiceDto();
      appointmentDto.store_id = store_id;
      appointmentDto.tenant_id = tenant_id;

      const appintmentWaitList =
        await this.customerJourneyService.appointmentWaitList(
          appointmentDto,
          pin,
          req.headers,
        );
      return res.json(
        this.utilityService.getResponse(
          appintmentWaitList,
          'Appointments fetched successfully.',
          HttpStatus.OK,
          true,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneycontroller: appointmentWaitList => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointments/:filter')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Finds appointments.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiHeader({
    name: 'customer_id',
    description: 'customer_id',
    required: false,
  })
  @ApiHeader({
    name: 'employee_id',
    description: 'employee_id',
    required: false,
  })
  @ApiParam({
    name: 'filter',
    type: String,
    description: 'upcoming/previous/ongoing/completed',
  })
  @ApiQuery({
    name: 'start',
    type: Number,
    description: 'start',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: 'limit',
    required: false,
  })
  @ApiQuery({
    name: 'store_id',
    type: String,
    description: 'store_id',
    required: false,
  })
  @ApiQuery({
    name: 'date',
    type: String,
    description: 'date',
    required: false,
  })
  async findAppointments(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('customer_id') customer_id: string,
    @Headers('employee_id') employee_id: string,
    @Headers('domain_name') domain_name: string,
    @Headers('tenant_id') tenant_id: string,
    @Param('filter') filter: string,
    @Query('start') start: number,
    @Query('limit') limit: number,
    @Query('store_id') store_id: string,
    @Query('date') date: string,
  ) {
    try {
      this.logger.info(
        `CustomerJourneycontroller : Enter findAppointments Method`,
      );
      let appointments = [];
      const appointmentDto = new AppointmentDto();
      appointmentDto.customer_id = customer_id;
      appointmentDto.employee_id = employee_id;
      appointmentDto.domain_name = domain_name;
      appointmentDto.tenant_id = tenant_id;
      appointmentDto.filter = filter;
      appointmentDto.start = start;
      appointmentDto.limit = limit;
      appointmentDto.store_id = store_id;
      appointmentDto.date = date;
      if (filter === 'previous') {
        appointments =
          await this.customerJourneyService.findPreviousAppointments(
            appointmentDto,
          );
      } else if (appointmentDto.filter === 'upcoming') {
        appointments =
          await this.customerJourneyService.findUpcomingAppointments(
            appointmentDto,
          );
      } else if (appointmentDto.filter === 'ongoing') {
        appointments = await this.customerJourneyService.findOngingAppointments(
          appointmentDto,
        );
      } else if (appointmentDto.filter === 'completed') {
        appointments =
          await this.customerJourneyService.findCompletedAppointments(
            appointmentDto,
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
      this.logger.info(
        `CustomerJourneycontroller : Exit findAppointments Method`,
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
        `Error: CustomerJourneycontroller: findAppointments => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/update')
  /*@UseGuards(JwtAuthGuard)
  @ApiBearerAuth()*/
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

      // set key for the user with all cutters booked
      const appointment = await this.customerJourneyService.appointmentUpdate(
        requestDto.req_param,
        tenant_id,
        domain_name,
      );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `update_appointment`,
        { message: AuditMessageEnum.UPDATE_APPOINTMENT },
        queue_name.toLocaleLowerCase(),
      );

      this.logger.info(
        `AppointmentsController : Exit appointmentUpdate Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          appointment,
          'Appointment updated successfully.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneycontroller: appointmentUpdate => ${err}`,
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

  @Get('appointment/:id')
  /*@UseGuards(JwtAuthGuard)
  @ApiBearerAuth()*/
  @ApiOperation({ summary: 'Get one appointment.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiQuery({
    name: 'appointment_service_id',
    type: String,
    description: 'appointment_service_id',
    required: false,
  })
  async findOneAppointment(
    @Res() res: Response,
    @Req() req: Request,
    @Param('id') id: string,
    @Headers('tenant_id') tenant_id: string,
    @Headers('domain_name') domain_name: string,
    @Query('appointment_service_id') appointment_service_id: string,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter findOneAppointment Method`,
      );
      const appointment = await this.customerJourneyService.findOneAppointment(
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
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/clear-slots')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Remove slots' })
  @ApiOkResponse({ type: ResponseDto })
  async clearBookedSlots(
    @Res() res: Response,
    @Body() cleareSlotsDto: CJClearSlotsRequestDto,
  ) {
    try {
      this.logger.info(
        `AppointmentsController : Enter clearBookedSlots Method`,
      );
      await this.customerJourneyService.clearBookedSlots(
        cleareSlotsDto.req_param,
      );
      this.logger.info(`AppointmentsController : Exit clearBookedSlots Method`);
      return res.json(
        this.utilityService.getResponse(
          '',
          Language.SUCESS.MSG_CLEAR_SLOTS,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: AppointmentsController: clearBookedSlots => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
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
    @Body() editAppointmenRequestDto: CJAppointmentEditRequestDto,
  ) {
    try {
      this.logger.info(
        `CustomerJourneycontroller : Enter editAppointment Method`,
      );
      const editAppointmentDto = editAppointmenRequestDto.req_param;
      editAppointmentDto.customer_id = customer_id;
      editAppointmentDto.domain_name = domain_name;
      const appointment = await this.customerJourneyService.editAppointment(
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
      this.logger.info(
        `CustomerJourneycontroller : Exit editAppointment Method`,
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
        `Error: CustomerJourneycontroller: editAppointment => ${err}`,
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

  @Get('appointment/config/:tenant_id')
  /*@UseGuards(JwtAuthGuard)
  @ApiBearerAuth()*/
  @ApiOperation({ summary: 'Get config for appointment.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async findConfig(
    @Res() res: Response,
    @Req() req: Request,
    @Param('tenant_id') tenant_id: string,
  ) {
    try {
      this.logger.info(`CustomerJourneycontroller : Enter findConfig Method`);
      const config = await this.customerJourneyService.findConfig(tenant_id);
      this.logger.info(`CustomerJourneycontroller : Exit findConfig Method`);
      return res.json(
        this.utilityService.getResponse(
          config,
          'Config fetched successfully.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneycontroller: findConfig => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/configForInStore/:tenant_id')
  @ApiOperation({ summary: 'Get config for In store category appointment.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async findconfigForInStore(
    @Res() res: Response,
    @Param('tenant_id') tenant_id: string,
  ) {
    try {
      this.logger.info(`CustomerJourneycontroller : Enter findConfig Method`);
      let configData = {};
      const config = await this.customerJourneyService.findConfigForInStore(
        tenant_id,
      );
      if (config.length) {
        configData = config[config.length - 1]['value'];
      }
      this.logger.info(`CustomerJourneycontroller : Exit findConfig Method`);
      return res.json(
        this.utilityService.getResponse(
          configData,
          'Config fetched successfully.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneycontroller: findConfig => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Post('appointment/manage-guest')
  /*@UseGuards(JwtAuthGuard)
  @ApiBearerAuth()*/
  @ApiOperation({ summary: 'Add guest' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async addGuest(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('tenant_id') tenant_id: string,
    @Body() addGuestDto: CJAddGuestRequestDto,
  ) {
    try {
      this.logger.info(`CustomerJourneycontroller : Enter addGuest Method`);
      await this.customerJourneyService.addGuest(
        addGuestDto.req_param,
        req.headers,
      );
      this.logger.info(`CustomerJourneycontroller : Exit addGuest Method`);
      return res.json(
        this.utilityService.getResponse(
          {},
          Language.SUCESS.MSG_GUEST_MANAGE,
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(`Error: CustomerJourneycontroller: addGuest => ${err}`);
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('appointment/rebook/manage-cart/:appointment_id')
  /*@UseGuards(JwtAuthGuard)
  @ApiBearerAuth()*/
  @ApiOperation({ summary: 'Appointment rebook manage cart.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async manageCartAppointmentRebook(
    @Res() res: Response,
    @Req() req: Request,
    @Param('appointment_id') appointment_id: string,
    @Query('is_rebook_by_admin') is_rebook_by_admin: number,
    @Headers('customer_id') customer_id: string,
  ) {
    try {
      this.logger.info(
        `CustomerJourneycontroller : Enter manageCartAppointmentRebook Method`,
      );
      const appointmentEditDto = new CJAppointmentEditDto();
      appointmentEditDto.customer_id = customer_id;
      appointmentEditDto.appointment_id = appointment_id;
      const appointment =
        await this.customerJourneyService.manageCartAppointmentRebook(
          appointmentEditDto,
          is_rebook_by_admin,
        );
      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `rebook_managed_to_cart`,
        { message: AuditMessageEnum.LOG_REBOOK_MANAGED_TO_CART },
        queue_name.toLocaleLowerCase(),
      );
      this.logger.info(
        `CustomerJourneycontroller : Exit manageCartAppointmentRebook Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          appointment,
          'Appointment rebook managed to cart.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneycontroller: manageCartAppointmentRebook => ${err}`,
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

  @Get('appointment/employee/store-list')
  /*@UseGuards(JwtAuthGuard)
  @ApiBearerAuth()*/
  @ApiOperation({ summary: 'Appointment employee store list.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async appointmentEmployeeStoreList(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('employee_id') employee_id: string,
  ) {
    try {
      this.logger.info(
        `CustomerJourneycontroller : Enter appointmentEmployeeStoreList Method`,
      );
      const stores =
        await this.customerJourneyService.appointmentEmployeeStoreList(
          employee_id,
        );
      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        `appointment_employee_store_list`,
        { message: AuditMessageEnum.LOG_APPOINTMENT_EMPLOYEE_STORE_LIST },
        queue_name.toLocaleLowerCase(),
      );
      this.logger.info(
        `CustomerJourneycontroller : Exit appointmentEmployeeStoreList Method`,
      );
      return res.json(
        this.utilityService.getResponse(
          stores,
          'Appointment employee stores are fetched successfully. .',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneycontroller: appointmentEmployeeStoreList => ${err}`,
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

  @Get('/appointment/employee/store-wise')
  //@UseGuards(JwtAuthGuard)
  //@ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch all appointment employee store-wise' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async fetchAllAppointmnetForEmployeeStoreWise(
    @Res() res: Response,
    @Req() req: Request,
    @Headers('employee_id') employee_id: string,
    @Query('date') date: string,
  ) {
    try {
      this.logger.info(
        `CustomerJourneycontroller : Enter fetchAllAppointmnetForEmployeeStoreWise Method`,
      );

      const appointments =
        await this.customerJourneyService.getAppoinmentEmployeeStoreWise(
          employee_id,
          date,
        );

      // activity log
      const queue_name = `${process.env.MODE}_audit_queue`;
      await this.auditRabbitMQService.sendAuditLog(
        req,
        'get_employee_storewise_appointment',
        { message: AuditMessageEnum.LOG_EMPLOYEE_STOREWISE_APPOINTMENT },
        queue_name.toLocaleLowerCase(),
      );

      return res.json(
        this.utilityService.getResponse(
          appointments,
          'Appointment employee storewise are fetched successfully.',
          HttpStatus.OK,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Error: CustomerJourneycontroller: fetchAllAppointmnetForEmployeeStoreWise => ${err}`,
      );
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }

  @Get('/appointment/customer/stores')
  @ApiOperation({ summary: 'Fetch stores.' })
  @ApiOkResponse({ type: ResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async fetchStores(
    @Res() res: Response,
    @Headers('tenant_id') tenant_id: string,
    @Query('city') city: string,
    @Query('lat') lat: number,
    @Query('long') long: number,
    @Query('start') start: number,
    @Query('limit') limit: number,
  ) {
    try {
      this.logger.info(`CustomerJourneycontroller : Enter fetchStores Method`);

      const getStores = await this.customerJourneyService.fetchStores(
        tenant_id,
        city,
        lat,
        long,
        start,
        limit,
      );
      this.logger.info(`CustomerJourneycontroller : Exit fetchStores Method`);
      return res.json(
        this.utilityService.getResponse(
          getStores.records,
          'stores are fetched successfully.',
          HttpStatus.OK,
          true,
          getStores.totalCount,
        ),
      );
    } catch (err) {
      this.logger.error(`Error: AppointmentsController: fetchStores => ${err}`);
      return res
        .status(400)
        .json(
          this.utilityService.getErrorResponse(err.status, err.message, err),
        );
    }
  }
}
