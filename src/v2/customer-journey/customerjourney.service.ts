import * as moment from 'moment-timezone';
import got from 'got';
import { v4 as uuidv4 } from 'uuid';
import { orderBy } from 'lodash';
import { InjectRepository } from '@nestjs/typeorm';
import { MvCutterSchedule } from '../../appointments/entities/mv-cutter-schedule.view';
import {
  In,
  LessThanOrEqual,
  Repository,
  MoreThan,
  Not,
  Between,
  MoreThanOrEqual,
  LessThan,
} from 'typeorm';
import { MvStores } from '../../appointments/entities/mv-store.view';
import { LoggerService } from '../../logger/logger.service';
import { CutterSlotsDto } from './dto/cutter-slots.dto';
import { Constant } from '../../common/config/constant';
import { Language } from '../../common/language/en';
import { UtilityService } from '../../common/libs/utility.service';
import { AppointmentsService } from '../../appointments/appointments.service';
import { FranchisorConfig } from '../../appointments/entities/franchisor-config.entity';
import { MvServices } from '../../appointments/entities/mv-service-view.entity';
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RedisCacheService } from '../../redis/redis.service';
import { CJAddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CJAddInstructionDto } from './dto/add-instruction.dto';
import { RemoveCartDto } from './dto/remove-cart.dto';
import { CJAppointmentConfirmDto } from './dto/confirm-appointment.dto';
import { Franchisor } from '../../appointments/entities/franchisor.entity';
import { NotificationCategory } from '../../appointments/entities/notification-category.entity';
import { NotificationType } from '../../appointments/entities/notification-type.entity';
import { CustomerCancellationpolicy } from './entities/customer-cancellation.entity';
import { CancellationPolicyDto } from './dto/cancellation-poilcy.dto';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { AppointmentService } from '../../appointments/entities/appointment-service.entity';
import { AppointmentBookDto } from '../../appointments/dto/appointment.dto';
import { AppointmentServiceDto } from '../../appointments/dto/appointment-service.dto';
import { MvAppointments } from '../../appointments/entities/mv-appointment.view';
import { CustomerView } from '../../users/entities/mv-customer.view';
import { UpdateRedisKeyDto } from './dto/update-redis-key.dto';
import { AppointmentEnum } from '../../common/enum/appointment.enum';
import { CustomerUser } from '../../users/entities/customer-user.entity';
import { CustomerGuestUser } from '../../users/entities/customer-guest-user.entity';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { AppointmentDto } from './dto/appointment.dto';
import { UpdateAppointment } from '../../appointments/dto/update-appointment.dto';
import { CJClearSlotDto } from './dto/clear-slots.dto';
import { CJAppointmentEditDto } from './dto/edit-appointment.dto';
import { CJAddGuestDto } from './dto/add-guest.dto';
import { CustomerJourneyUtility } from './customerjourney.utility';
import { StoreServices } from './entities/service.entity';
import { MvBrands } from '../../appointments/entities/mv-brands.view';
import { ECSLoggerService } from '../../logger/ECSlogger.service';

@Injectable()
export class CustomerJourneyService {
  constructor(
    @InjectRepository(MvCutterSchedule)
    private cutterScheduleRepository: Repository<MvCutterSchedule>,
    @InjectRepository(MvStores)
    private storeDetailRepository: Repository<MvStores>,
    @InjectRepository(FranchisorConfig)
    private franchisorConfigRepository: Repository<FranchisorConfig>,
    @InjectRepository(MvServices)
    private serviceViewRepository: Repository<MvServices>,
    @InjectRepository(Franchisor)
    private franchisorRepository: Repository<Franchisor>,
    @InjectRepository(NotificationCategory)
    private notificationCategoryRepository: Repository<NotificationCategory>,
    @InjectRepository(NotificationType)
    private notificationTypeRepository: Repository<NotificationType>,
    @InjectRepository(CustomerCancellationpolicy)
    private customerCancellationPolicy: Repository<CustomerCancellationpolicy>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(AppointmentService)
    private appointmentServiceRepository: Repository<AppointmentService>,
    @InjectRepository(MvAppointments)
    private appointmentViewRepository: Repository<MvAppointments>,
    @InjectRepository(CustomerView)
    private customerViewRepository: Repository<CustomerView>,
    @InjectRepository(CustomerUser)
    private customerUserRepository: Repository<CustomerUser>,
    @InjectRepository(CustomerGuestUser)
    private customerGuestUserRepository: Repository<CustomerGuestUser>,
    @InjectRepository(StoreServices)
    private serviceRepository: Repository<StoreServices>,
    private readonly loggerService: LoggerService,
    private readonly appointmentService: AppointmentsService,
    private readonly utilityService: UtilityService,
    private readonly redisService: RedisCacheService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly customerJourneyUtility: CustomerJourneyUtility,
    private readonly ECSloggerService: ECSLoggerService,
    @InjectRepository(MvBrands)
    private brandViewRepository: Repository<MvBrands>,
  ) {}
  public logger = this.loggerService.initiateLogger();
  public ECSlogger = this.loggerService.initiateLogger();

  async getCarasoulServices(
    queryParams,
    domain_name: string,
    tenant_id: string,
  ) {
    try {
      const storeList = [];
      const storeids = [];
      const latitude = queryParams.lat;
      const longitude = queryParams.long;
      let storeDistance = {};
      let distanceKey = '';
      if (
        latitude &&
        longitude &&
        queryParams?.show_time_to_reach &&
        queryParams?.show_time_to_reach.toLowerCase() === 'true'
      ) {
        distanceKey =
          Constant.REDIS.distanceKey +
          `${queryParams.city}_${latitude}_${longitude}`;
        const storeRedisData = await this.redisService.get(distanceKey);
        storeDistance = storeRedisData || storeDistance;
      }
      // const currentData = new Date().getDay();
      // const dayName = Constant.WEEK_DAYS[currentData];

      //Fetch stores by city name
      let storeData = await this.storeDetailRepository.query(`
              SELECT DISTINCT(id) as store_id, weekday, name as store_name, timezone,concat('2021-01-01 ',store_open_time)::timestamp as finalDate, store_open_time, store_end_time as store_close_time, street_name, address, suite_number, country, zipcode, state, city, primary_contact as contact, geo_lat, geo_long, logo
              FROM public.mv_stores WHERE status=2 AND city='${queryParams.city}' AND  tenant_id = '${tenant_id}' and is_deleted=false ORDER BY finalDate ASC`);

      storeData = storeData.filter((item) => {
        const storeTimezone = item?.timezone || 'GMT';
        const tzOffset = Constant.timezones[storeTimezone];
        const currentTime = moment()
          .tz(tzOffset)
          .format(Constant.DATE_FORMAT.YMD);
        const currentDay = new Date(currentTime).getDay();
        const dayName = Constant.WEEK_DAYS[currentDay];
        return item['weekday'] === dayName;
      });

      if (storeData.length === 0) {
        throw new Error(Language.ERROR.ERR_STORE_NOT_FOUND);
      }

      const [configObj] = await this.franchisorConfigRepository.find({
        where: {
          category: 'appointment_service_config',
          tenant_id,
        },
      });

      const storesSlots = {};

      // fetch the existing slots which are already booked in db or in cart by other user
      let bookedSlots = await this.getRedisCartDetails();
      const startDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_START);
      const endDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_END);

      const bookedSlotsFromDB = await this.getBookedSlots(
        startDate,
        endDate,
        tenant_id,
      );

      bookedSlots = [...bookedSlots, ...bookedSlotsFromDB];

      for (const storeItem of storeData) {
        storeids.push(storeItem.store_id);
        // calulate store details
        if (!storesSlots[storeItem.store_id]) {
          storesSlots[storeItem.store_id] =
            await this.calculateStoreDetailsForCaraousel(
              storeItem.store_id,
              configObj,
              tenant_id,
              storeItem?.timezone,
            );
          storesSlots[storeItem.store_id]['shifts'] = [
            {
              store_open_time: storeItem.store_open_time,
              store_close_time: storeItem.store_close_time,
            },
          ];
        } else {
          if (storesSlots[storeItem.store_id]['shifts']) {
            storesSlots[storeItem.store_id]['shifts'].push({
              store_open_time: storeItem.store_open_time,
              store_close_time: storeItem.store_close_time,
            });
          }
        }

        // calculate image
        storeItem['store_image'] = await this.getImage(
          storeItem?.logo,
          tenant_id,
        );
      }
      const storeIdValue = storeids.join("', '");
      //Fetch service by store id
      const serviceList = await this.serviceViewRepository
        .query(`SELECT DISTINCT(service_id) as id, service_name as name, service_description, approx_time , price, store_id , discount, service_image_url, service_order
          FROM public.mv_services WHERE store_id IN('${storeIdValue}') and is_quick_service=true ORDER BY service_order`);
      const serviceListsortedData = serviceList.sort(function (a, b) {
        const x = a.store_id.toLowerCase();
        const y = b.store_id.toLowerCase();
        if (x > y) {
          return 1;
        }
        if (x < y) {
          return -1;
        }
        return 0;
      });
      const storeIdsWithservices = [];
      for (const serviceItem of serviceListsortedData) {
        const storeDataList = storeData.find(
          (item) => item.store_id === serviceItem.store_id,
        );
        storeDataList['shifts'] = storesSlots[storeDataList.store_id]['shifts'];
        storeIdsWithservices.push(storeDataList.store_id);

        /*if (
          queryParams?.show_time_to_reach &&
          queryParams?.show_time_to_reach.toLowerCase() === 'true' &&
          storeGoogleAPI.indexOf(storeDataList.store_id) === -1
        ) {
          if (latitude && longitude) {
            if (storeDistance && storeDistance[storeDataList.store_id]) {
              getTravelTime = storeDistance[storeDataList.store_id];
              storeGoogleAPI.push(storeDataList.store_id);
            } else {
              getTravelTime = await this.(
                latitude,
                longitude,
                storeDataList['geo_lat'],
                storeDataList['geo_long'],
              );
              storeGoogleAPI.push(storeDataList.store_id);
            }

            if (!storeDistance[storeDataList.store_id]) {
              storeDistance[storeDataList.store_id] = getTravelTime
                ? getTravelTime['durationInMins']
                : '';
            }
          }
        }*/
        storeDataList['name'] = storeDataList?.store_name;
        storeDataList['id'] = storeDataList?.store_id;
        storeDataList['is_store_favourite'] = '';
        storeDataList['distance'] = '';
        // storeDataList['is_opened'] =
        //   storeDataList?.store_open_time && storeDataList?.store_close_time
        //     ? true
        //     : false;
        const storeTimezone = storeDataList?.timezone || 'GMT';
        const tzOffset = Constant.timezones[storeTimezone];
        const currentTime = moment()
          .tz(tzOffset)
          .format(Constant.DATE_FORMAT.YMD);

        if (storeDataList?.store_close_time === '12:00 AM') {
          storeDataList.store_close_time = '11:59 PM';
        }

        const diff = await this.calculateDateDifference(
          storeDataList?.store_open_time,
          storeDataList?.store_close_time,
          currentTime,
          tzOffset,
        );

        let isOpenedOrNot = false;

        for (let i = 0; i < storeData.length; i++) {
          if (storeData[i].store_id === serviceItem.store_id) {
            const storeTimezone = storeData[i].timezone || 'GMT';
            const tzOffset = Constant.timezones[storeTimezone];
            const currentTime = moment()
              .tz(tzOffset)
              .format(Constant.DATE_FORMAT.YMD);

            if (storeData[i].store_close_time === '12:00 AM') {
              storeData[i].store_close_time = '11:59 PM';
            }

            const diff = await this.calculateDateDifference(
              storeData[i].store_open_time,
              storeData[i].store_close_time,
              currentTime,
              tzOffset,
            );

            if (
              moment(diff.storeCurrentDate).isAfter(moment(diff.startTime)) &&
              moment(diff.storeCurrentDate).isBefore(moment(diff.endTime))
            ) {
              //storeDataList['is_opened'] = true;
              isOpenedOrNot = true;
              break;
            } else {
              isOpenedOrNot = false;
            }
          }
        }

        if (isOpenedOrNot) {
          storeDataList['is_opened'] = true;
        } else {
          storeDataList['is_opened'] = false;
        }

        // if (
        //   moment(diff.storeCurrentDate).isAfter(moment(diff.startTime)) &&
        //   moment(diff.storeCurrentDate).isBefore(moment(diff.endTime))
        // ) {
        //   storeDataList['is_opened'] = true;
        // } else {
        //   storeDataList['is_opened'] = false;
        // }

        // if (diff) {
        //   storeDataList['is_opened'] = true;
        // } else {
        //   storeDataList['is_opened'] = false;
        // }

        // const start_time = moment(
        //   storeDataList?.store_open_time,
        //   'hh:mm A',
        // ).tz(tzOffset).format(Constant.DATE_FORMAT.YMD_THMD);
        // let after_time = moment(
        //   storeDataList?.store_close_time,
        //   'hh:mm A',
        // ).tz(tzOffset).format(Constant.DATE_FORMAT.YMD_THMD);

        // if (storeDataList?.store_close_time === '12:00 AM') {
        //   after_time = moment(storeDataList?.store_close_time, 'hh:mm A')
        //     .subtract(1, 'minute')
        //     .add(1, 'day')
        //     .format(Constant.DATE_FORMAT.YMD_THMD);
        // }
        // if (
        //   storeDataList?.store_open_time &&
        //   storeDataList?.store_close_time &&
        //   new Date(currentTime) >= new Date(start_time) &&
        //   new Date(currentTime) <= new Date(after_time)
        // ) {
        //   storeDataList['is_opened'] = true;
        // } else {
        //   storeDataList['is_opened'] = false;
        // }

        // serviceItem['service_image'] = await this.getImage(
        //   serviceItem?.service_image_url,
        //   domain_name,
        // );

        serviceItem['service_image'] = serviceItem?.service_image_url;

        const duration = await this.utilityService.convertH2M(
          serviceItem.approx_time,
        );
        if (duration > 0) {
          serviceItem['approx_time'] = duration;
          // calculate slots
          if (storesSlots[storeDataList.store_id]) {
            const obj = storesSlots[storeDataList.store_id];
            let slots = [];
            const currentStartTime = moment(diff.storeCurrentDate)
              .add(obj.sleeping_time, 'minutes')
              .format(Constant.DATE_FORMAT.YMD_HMD_START_SECOND);

            // AMP-7967
            // currentStartTime =
            //   new Date(currentStartTime) >= new Date(diff.startTime)
            //     ? currentStartTime
            //     : diff.startTime;
            if (
              !moment(diff.storeCurrentDate).isAfter(moment(diff.endTime)) &&
              obj?.startDate &&
              obj?.endDate
            ) {
              slots = await this.newCheckCutterAvailability(
                'caroursel',
                storeDataList.store_id,
                currentStartTime,
                moment(diff.endTime).format(Constant.DATE_FORMAT.YMD_HMD_END),
                duration,
                obj.time_gap_between_slots,
                tenant_id,
                obj.max_slots_caraousel,
                bookedSlots,
                null,
                null,
                null,
              );
            }
            serviceItem['slots'] = slots;
          }
        } else {
          serviceItem['approx_time'] = 0;
          serviceItem['slots'] = [];
        }
        serviceItem['discount'] = serviceItem['discount']
          ? +serviceItem['discount']
          : 0;
        // Calculate discount price
        serviceItem['discounted_price'] =
          serviceItem.discount && +serviceItem.discount
            ? +(
                serviceItem.price -
                (serviceItem.price * +serviceItem.discount) / 100
              ).toFixed(2)
            : serviceItem.price;
        serviceItem['date'] = moment().format(Constant.DATE_FORMAT.YMD);
        storeList.push({
          store_details: storeDataList,
          service_details: serviceItem,
        });
      }
      let getTravelTimeOne;
      // Add only store obj
      for (const storeObj of storeData) {
        if (storeIdsWithservices.indexOf(storeObj.store_id) === -1) {
          /*if (
            queryParams?.show_time_to_reach &&
            queryParams?.show_time_to_reach.toLowerCase() === 'true' &&
            storeIdAPI.indexOf(storeObj.store_id) === -1
          ) {
            if (latitude && longitude) {
              if (storeDistance && storeDistance[storeObj.store_id]) {
                getTravelTime = storeDistance[storeObj.store_id];
                storeGoogleAPI.push(storeObj.store_id);
              } else {
                getTravelTimeOne = await this.getEstimatedTime(
                  latitude,
                  longitude,
                  storeObj['geo_lat'],
                  storeObj['geo_long'],
                );
                storeIdAPI.push(storeObj.store_id);
              }

              if (!storeDistance[storeObj.store_id]) {
                storeDistance[storeObj.store_id] = getTravelTime
                  ? getTravelTime['durationInMins']
                  : '';
              }
            }
          }*/
          storeObj['name'] = storeObj?.store_name;
          storeObj['id'] = storeObj?.store_id;
          storeObj['is_store_favourite'] = '';
          storeObj['distance'] = getTravelTimeOne
            ? getTravelTimeOne['durationInMins']
            : '';

          let isOpenedOrNot = false;

          for (let i = 0; i < storeData.length; i++) {
            if (storeData[i].store_id === storeObj.store_id) {
              const storeTimezone = storeData[i].timezone || 'GMT';
              const tzOffset = Constant.timezones[storeTimezone];
              const currentTime = moment()
                .tz(tzOffset)
                .format(Constant.DATE_FORMAT.YMD);

              if (storeData[i].store_close_time === '12:00 AM') {
                storeData[i].store_close_time = '11:59 PM';
              }

              const diff = await this.calculateDateDifference(
                storeData[i].store_open_time,
                storeData[i].store_close_time,
                currentTime,
                tzOffset,
              );

              // Adding store shifts

              storeObj['shifts'] = [
                {
                  store_open_time: storeData[i].store_open_time,
                  store_close_time: storeData[i].store_close_time,
                },
              ];

              if (
                moment(diff.storeCurrentDate).isAfter(moment(diff.startTime)) &&
                moment(diff.storeCurrentDate).isBefore(moment(diff.endTime))
              ) {
                //storeDataList['is_opened'] = true;
                isOpenedOrNot = true;
                break;
              } else {
                isOpenedOrNot = false;
              }
            }
          }
          if (isOpenedOrNot) {
            storeObj['is_opened'] = true;
          } else {
            storeObj['is_opened'] = false;
          }

          // const storeTimezone = storeData?.timezone || 'GMT';
          // const tzOffset = Constant.timezones[storeTimezone];
          // const currentTime = moment().tz(tzOffset);

          // const start_time = moment(storeObj?.store_open_time, 'hh:mm A');
          // const after_time = moment(storeObj?.store_close_time, 'hh:mm A');

          // if (
          //   storeObj?.store_open_time &&
          //   storeObj?.store_close_time &&
          //   currentTime.isBetween(start_time, after_time)
          // ) {
          //   storeObj['is_opened'] = true;
          // } else {
          //   storeObj['is_opened'] = false;
          // }

          // const storeTimezone = storeData?.timezone || 'GMT';
          // const tzOffset = Constant.timezones[storeTimezone];
          // const currentTime = moment()
          //   .tz(tzOffset)
          //   .format(Constant.DATE_FORMAT.YMD_THMD);

          // const start_time = moment(
          //   storeData?.store_open_time,
          //   'hh:mm A',
          // ).format(Constant.DATE_FORMAT.YMD_THMD);
          // let after_time = moment(
          //   storeData?.store_close_time,
          //   'hh:mm A',
          // ).format(Constant.DATE_FORMAT.YMD_THMD);

          // if (storeDataList?.store_close_time === '12:00 AM') {
          //   after_time = moment(storeDataList?.store_close_time, 'hh:mm A')
          //     .subtract(1, 'minute')
          //     .add(1, 'day')
          //     .format(Constant.DATE_FORMAT.YMD_THMD);
          // }
          // if (
          //   storeData?.store_open_time &&
          //   storeData?.store_close_time &&
          //   new Date(currentTime) >= new Date(start_time) &&
          //   new Date(currentTime) <= new Date(after_time)
          // ) {
          //   storeData['is_opened'] = true;
          // } else {
          //   storeData['is_opened'] = false;
          // }
          storeList.push({
            store_details: storeObj,
            service_details: {},
          });
        }
      }

      if (distanceKey) {
        // save object in redis
        await this.redisService.set(
          distanceKey,
          storeDistance,
          Constant.REDIS.storeDetailTTL,
        );
      }
      return storeList;
    } catch (err) {
      throw err;
    }
  }

  async getAvailableSlots1(
    req: any,
    cutterSlotsDto: CutterSlotsDto,
    paginationObj,
  ) {
    try {
      const newResultObj = {
        userwise_cutter_data: [],
        currentDate: '',
        message_type: '',
        timezone: '',
      };

      const [storeData] = await this.serviceViewRepository.query(
        `SELECT * FROM public.mv_stores where id = '${cutterSlotsDto.store_id}'`,
      );

      if (storeData?.timezone) {
        const storeTimezone = storeData?.timezone || 'GMT';
        const tzOffset = Constant.timezones[storeTimezone];
        const currentTime = moment()
          .tz(tzOffset)
          .format(Constant.DATE_FORMAT.YMD);

        const incomingDate = moment(cutterSlotsDto.date).format(
          Constant.DATE_FORMAT.YMD,
        );

        if (new Date(currentTime) > new Date(incomingDate)) {
          throw new Error(Language.ERROR.ERR_PREVIOUS_DAY_SERVICE_SELECTION);
        }
      }

      let counter = 1;
      for (const obj of cutterSlotsDto.duration) {
        const objToPush = {};
        if (obj.customer_id) {
          objToPush['customer_id'] = obj.customer_id;
          objToPush['counter'] = counter;
        }
        if (obj.guest_id) {
          objToPush['guest_id'] = obj.guest_id;
          objToPush['counter'] = counter;
        }
        objToPush['cutters'] = [];
        objToPush['duration'] = 0;
        objToPush['recommendedCutter'] = [];
        objToPush['cutters_mobile'] = [];
        newResultObj.userwise_cutter_data.push(objToPush);
        counter += 1;
      }
      // Fetch store details
      const storeDetails = await this.getStoreDetails(
        cutterSlotsDto.store_id,
        cutterSlotsDto.date,
        req.headers.tenant_id,
      );

      if (!storeDetails.store_open_time && !storeDetails.store_end_time) {
        return newResultObj;
      }

      // Slot Algorithm start
      // STEP 1:: fetch sleepoing time from config table
      // TODO:: Using franchasior config table directly
      const [configObj] = await this.franchisorConfigRepository.find({
        where: {
          category: 'appointment_service_config',
          tenant_id: req.headers.tenant_id,
        },
      });

      // this is the flag to add buffer time before calculating the first slot.
      const sleeping_time = configObj?.value
        ? +configObj.value['sleeping_time']
        : +Constant.sleeping_time;

      // this is the flag to add difference between two slots.
      const time_gap_between_slots = configObj?.value
        ? +configObj.value['time_gap_between_slots']
        : +Constant.time_gap_between_slots;

      // step2: define start date and end date for slots
      const actualStartDate = moment(storeDetails.storeCurrentDate)
        .add(sleeping_time, 'minutes')
        .format(Constant.DATE_FORMAT.YMD_HMD_START_SECOND);

      let { startDate, endDate } = await this.calculateDateRange(
        storeDetails.store_open_time,
        storeDetails.store_end_time,
        actualStartDate,
        cutterSlotsDto.date,
        'slots',
      );

      // AMP-7967
      // startDate = `${cutterSlotsDto.date} 00:00:00`;
      if (cutterSlotsDto?.start_date) {
        startDate = cutterSlotsDto?.start_date;
      }

      endDate = moment(endDate).format(Constant.DATE_FORMAT.YMD_HMD_END);
      // fetch the existing slots which are already booked or in cart by other user
      let bookedSlots = await this.getRedisCartDetails();
      const redisSlots = [...bookedSlots];
      const bookedSlotsFromDB = await this.getBookedSlots(
        moment(startDate).format(Constant.DATE_FORMAT.YMD_HMD_START),
        moment(endDate).format(Constant.DATE_FORMAT.YMD_HMD_END),
        req.headers.tenant_id,
      );
      bookedSlots = [...bookedSlots, ...bookedSlotsFromDB];
      // HERE :: 8645

      // let existingSlotData = [];
      if (cutterSlotsDto.appointment_id) {
        const slotKeys =
          Constant.REDIS.editAppointmentSlotKey +
          cutterSlotsDto.appointment_id +
          `_*`;

        const allKeys = await this.redisService.keys(slotKeys);
        if (allKeys && allKeys.length) {
          let getExistingData: any = await this.redisService.mget(allKeys);
          getExistingData = [].concat(...getExistingData);
          // remove object from booked slots with same time_from and time_to
          if (getExistingData?.length) {
            // for (let slot of getExistingData) {
            //   const foundIndex = bookedSlots.findIndex((obj) => {
            //     return (
            //       obj.appointment_id === cutterSlotsDto.appointment_id &&
            //       obj.time_from === slot.time_from &&
            //       obj.time_to === slot.time_to &&
            //       obj.db_booked_slot
            //     );
            //   });

            //   console.log(foundIndex);
            //   if (foundIndex > -1) {
            //     bookedSlots[foundIndex]['removeItem'] = true;
            //   }
            // }

            // bookedSlots = bookedSlots.filter((slot) => !slot.removeItem);
            const actualSlots = bookedSlots.filter(
              (slot) => slot.appointment_id === cutterSlotsDto.appointment_id,
            );

            const slotsToRemove = [];
            if (actualSlots.length) {
              for (const slot of actualSlots) {
                const foundIndex = actualSlots.find(
                  (obj) =>
                    (obj.time_from == slot.time_from ||
                      obj.time_to == slot.time_to) &&
                    obj.db_booked_slot != slot.db_booked_slot,
                );

                if (!foundIndex) {
                  slotsToRemove.push(slot);
                }
              }
            }

            if (slotsToRemove?.length) {
              for (const slot of slotsToRemove) {
                const foundIndex = bookedSlots.findIndex((obj) => {
                  return (
                    obj.appointment_id === cutterSlotsDto.appointment_id &&
                    obj.time_from === slot.time_from &&
                    obj.time_to === slot.time_to &&
                    obj.db_booked_slot
                  );
                });

                if (foundIndex > -1) {
                  bookedSlots[foundIndex]['removeItem'] = true;
                }

                bookedSlots = bookedSlots.filter((slot) => !slot.removeItem);
              }
            }
          } else {
            // 8645 - we need to add is_selected flag only if slot is presend in redisslots
            const foundSlots = redisSlots.filter((slot) => {
              return (
                slot.appointment_id === cutterSlotsDto.appointment_id &&
                slot.time_from &&
                slot.time_to
              );
            });

            if (!foundSlots.length) {
              bookedSlots = bookedSlots.filter(
                (slot) =>
                  slot?.appointment_id !== cutterSlotsDto.appointment_id,
              );
            }
          }
        } else {
          // 8645 - we need to add is_selected flag only if slot is presend in redisslots
          const foundSlots = redisSlots.filter((slot) => {
            return (
              slot.appointment_id === cutterSlotsDto.appointment_id &&
              slot.time_from &&
              slot.time_to
            );
          });

          if (!foundSlots.length) {
            bookedSlots = bookedSlots.filter(
              (slot) => slot?.appointment_id !== cutterSlotsDto.appointment_id,
            );
          }
        }
      }

      const cuttersRatingObj = {};
      const durationObj = {};
      // For loop to calculate cutters for diff users
      cutterSlotsDto.duration = cutterSlotsDto.duration.sort((a, b) => {
        return (
          b.duration.reduce((a, b) => {
            return a + b;
          }, 0) -
          a.duration.reduce((a, b) => {
            return a + b;
          }, 0)
        );
      });
      for (const obj of cutterSlotsDto.duration) {
        const currentDuration = obj.duration.reduce((a, b) => {
          return a + b;
        }, 0);

        let cutters = [];
        // if (durationObj[currentDuration]) {
        //   cutters = JSON.parse(JSON.stringify(durationObj[currentDuration]));
        // } else {
        cutters = await this.newCheckCutterAvailability(
          'slots',
          cutterSlotsDto.store_id,
          startDate,
          endDate,
          +currentDuration,
          +time_gap_between_slots,
          req.headers.tenant_id,
          null,
          bookedSlots,
          cutterSlotsDto.cart_uniq_id,
          req.headers.guest_user_id,
          req.headers.customer_id,
          bookedSlotsFromDB,
          cutterSlotsDto.is_from_edit,
          paginationObj,
          obj.guest_id,
        );

        if (cutters.length) {
          // calculate rating
          for (let i = 0; i < cutters.length; i++) {
            if (cuttersRatingObj[cutters[i].employee_user_id]) {
              cutters[i]['rating'] =
                cuttersRatingObj[cutters[i].employee_user_id]['rating'];
              cutters[i]['total_number_of_rating'] =
                cuttersRatingObj[cutters[i].employee_user_id][
                  'total_number_of_rating'
                ];
            } else {
              //  TODO:: make this dynamic
              const rate = +(Math.random() * 5).toFixed(2);
              cutters[i]['rating'] = rate;
              cutters[i]['total_number_of_rating'] = 50;
              cuttersRatingObj[cutters[i].employee_user_id] = {
                rating: rate,
              };
              cuttersRatingObj[cutters[i].employee_user_id] = {
                ...cuttersRatingObj[cutters[i].employee_user_id],
                total_number_of_rating: 50,
              };
            }
            // assign object with duration key to save second query time
            durationObj[currentDuration] = [...cutters];
          }
        }

        const tzOffset = Constant.timezones[storeDetails?.timezone];
        /* 07-03-2022 Current date is not as per store's timezone
        newResultObj['currentDate'] = moment(
          cutters[0]?.cutter_availability[0]?.time_from).format(Constant.DATE_FORMAT.YMD);
        */
        // }
        newResultObj['currentDate'] = moment()
          .tz(tzOffset)
          .format(Constant.DATE_FORMAT.YMD);

        if (cutters.length) {
          // Assign cutters to respected object of newResultObj
          if (obj.customer_id) {
            const foundIndex = newResultObj.userwise_cutter_data.findIndex(
              (uobj) => uobj.customer_id === obj.customer_id,
            );

            if (foundIndex !== -1) {
              newResultObj.userwise_cutter_data[foundIndex]['cutters'] =
                JSON.parse(JSON.stringify(cutters));
              newResultObj.userwise_cutter_data[foundIndex]['duration'] =
                +currentDuration;
            }
          }
          if (obj.guest_id) {
            const foundIndex = newResultObj.userwise_cutter_data.findIndex(
              (uobj) => uobj.guest_id === obj.guest_id,
            );

            if (foundIndex !== -1) {
              newResultObj.userwise_cutter_data[foundIndex]['cutters'] =
                JSON.parse(JSON.stringify(cutters));
              newResultObj.userwise_cutter_data[foundIndex]['duration'] =
                +currentDuration;
            }
          }
        }
      }

      // Calculate recommended cutters for customer and guest
      const { userwise_cutters, message_type } =
        await this.customerJourneyUtility.calculateRecommendedCutters1(
          newResultObj.userwise_cutter_data,
          cutterSlotsDto,
          cutterSlotsDto.is_from_edit,
        );
      newResultObj['userwise_cutter_data'] = userwise_cutters;
      newResultObj.message_type = message_type;
      newResultObj.timezone = storeDetails?.timezone;
      return newResultObj;
    } catch (err) {
      throw err;
    }
  }

  async addToCart(headers: any, addToCartDto: CJAddToCartDto) {
    try {
      this.logger.info(`AppointmentsService : Enter addToCart Method`);
      this.ECSlogger.info(`AppointmentsService : Enter addToCart Method`);

      // let response = [];
      addToCartDto['tenant_id'] = headers['tenant_id'];
      addToCartDto['guest_user_id'] = headers['guest_user_id'] || '';
      const customer_id = headers.customer_id || addToCartDto.customer_id;
      addToCartDto['customer_id'] = customer_id || '';
      addToCartDto['time_from'] = addToCartDto['time_from'] || '';
      addToCartDto['time_to'] = addToCartDto['time_to'] || '';
      addToCartDto['is_from_carousel'] = +addToCartDto['is_from_carousel'] || 0;

      const [configObj] = await this.franchisorConfigRepository.find({
        where: {
          category: 'appointment_service_config',
          tenant_id: headers.tenant_id,
        },
      });

      let id = customer_id || headers.guest_user_id || addToCartDto.guest_id;
      if (!id) {
        id = addToCartDto.cart_uniq_id || uuidv4();
      }

      if (addToCartDto?.time_from) {
        const [storeData] = await this.serviceViewRepository.query(
          `SELECT * FROM public.mv_stores where id = '${addToCartDto.store_id}'`,
        );

        if (storeData?.timezone) {
          const storeTimezone = storeData?.timezone || 'GMT';
          const tzOffset = Constant.timezones[storeTimezone];
          const currentTime = moment()
            .tz(tzOffset)
            .format(Constant.DATE_FORMAT.YMD_THMD);

          const incomingDate = moment(addToCartDto.time_from).format(
            Constant.DATE_FORMAT.YMD_THMD,
          );

          if (new Date(currentTime) > new Date(incomingDate)) {
            throw new Error(Language.ERROR.ERR_PREVIOUS_DAY_SERVICE_SELECTION);
          }
        }
      }

      const key = Constant.REDIS.userCartKey + id;

      let getExistingData = (await this.redisService.get(key)) || [];

      const max_service_in_cart =
        configObj && +configObj.value['max_service_in_cart']
          ? +configObj.value['max_service_in_cart']
          : Constant.max_service_in_cart;

      const originalTtlTime =
        configObj && configObj.value['cart_timer_mins']
          ? +configObj.value['cart_timer_mins'] * 60
          : Constant.REDIS.TTL;

      const differentStoreServiceData = getExistingData.find(
        (obj) => obj.store_id !== addToCartDto['store_id'],
      );

      if (differentStoreServiceData && !addToCartDto.error_type) {
        return {
          error_message: Language.ERROR.ERR_DIFFERENT_STORE_SERVICE,
          error_type: 'different_store',
          status: false,
        };
      }

      if (getExistingData?.length && !addToCartDto.error_type) {
        const timeFromCount = getExistingData.filter((item) => !item.time_from);
        if (
          timeFromCount.length !== getExistingData.length ||
          (addToCartDto.time_from && addToCartDto.time_to)
        ) {
          return {
            error_message: Language.ERROR.ERR_CART_CONFIRMATION,
            error_type: 'clear_slots',
            status: false,
          };
        }
      }

      // based on error_type in body... remove service if incoming service is from diff store or clear previous slots
      if (
        addToCartDto.error_type === 'clear_slots' &&
        getExistingData?.length
      ) {
        getExistingData.forEach((obj) => {
          obj.time_from = '';
          obj.time_to = '';
          obj.cutter_id = '';
          obj.cutter_name = '';
          obj.cutter_profile_image = '';
        });

        // amp-8645
        if (addToCartDto.appointment_id) {
          // remomve edit keys
          const slotKey =
            Constant.REDIS.editAppointmentSlotKey +
            addToCartDto.appointment_id +
            '_*';
          const slotKeys = await this.redisService.keys(slotKey);
          if (slotKeys?.length > 0) {
            // Delete cart data from redis
            for (const key of slotKeys) {
              this.redisService.del(key);
            }
          }
        }
      }

      if (addToCartDto.error_type === 'different_store') {
        // getExistingData = [];
        await this.redisService.set(key, []);
        getExistingData = [];
      }
      if (getExistingData?.length) {
        if (customer_id && !addToCartDto?.guest_id) {
          if (addToCartDto?.service_id) {
            const serviceContainOrNot = getExistingData.filter(
              (item) =>
                item.service_id === addToCartDto.service_id &&
                item.customer_id === customer_id &&
                !item.guest_id,
            );
            if (serviceContainOrNot?.length) {
              throw new Error(Language.ERROR.ERR_CUSTOMER_SERVICE_ID);
            }
          }

          if (addToCartDto?.package_id) {
            const packageContainOrNot = getExistingData.filter(
              (item) =>
                item?.package_id === addToCartDto?.package_id &&
                item.customer_id === customer_id &&
                !item.guest_id,
            );
            if (packageContainOrNot?.length) {
              throw new Error(Language.ERROR.ERR_CUSTOMER_SERVICE_ID);
            }
          }
          const serviceCount = getExistingData.filter(
            (item) => item.customer_id === customer_id && !item.guest_id,
          );
          if (serviceCount.length >= max_service_in_cart) {
            throw new Error(Language.ERROR.ERR_REACHED_MAX_CART_LIMIT);
          }
        } else if (customer_id && addToCartDto.guest_id) {
          if (addToCartDto?.service_id) {
            const serviceContainOrNot = getExistingData.filter(
              (item) =>
                item.service_id === addToCartDto.service_id &&
                item.customer_id === customer_id &&
                item.guest_id,
            );
            if (serviceContainOrNot?.length) {
              throw new Error(Language.ERROR.ERR_GUEST_USER_SERVICE_ID);
            }
          }

          if (addToCartDto?.package_id) {
            const packageContainOrNot = getExistingData.filter(
              (item) =>
                item?.package_id === addToCartDto?.package_id &&
                item.customer_id === customer_id &&
                item.guest_id,
            );
            if (packageContainOrNot?.length) {
              throw new Error(Language.ERROR.ERR_GUEST_USER_SERVICE_ID);
            }
          }

          const serviceCount = getExistingData.filter(
            (item) =>
              item.customer_id === customer_id &&
              item.guest_id === addToCartDto.guest_id,
          );
          if (serviceCount.length >= max_service_in_cart) {
            throw new Error(Language.ERROR.ERR_REACHED_MAX_CART_LIMIT);
          }
        } else if (headers.guest_user_id && !addToCartDto.guest_id) {
          if (addToCartDto?.service_id) {
            const serviceContainOrNot = getExistingData.filter(
              (item) =>
                item.service_id === addToCartDto.service_id &&
                item.guest_user_id === headers.guest_user_id &&
                !item.guest_id,
            );
            if (serviceContainOrNot?.length) {
              throw new Error(Language.ERROR.ERR_CUSTOMER_SERVICE_ID);
            }
          }

          if (addToCartDto?.package_id) {
            const packageContainOrNot = getExistingData.filter(
              (item) =>
                item?.package_id === addToCartDto?.package_id &&
                item.guest_user_id === headers.guest_user_id &&
                !item.guest_id,
            );
            if (packageContainOrNot?.length) {
              throw new Error(Language.ERROR.ERR_CUSTOMER_SERVICE_ID);
            }
          }

          const serviceCount = getExistingData.filter(
            (item) =>
              item.guest_user_id === headers.guest_user_id && !item.guest_id,
          );
          if (serviceCount.length >= max_service_in_cart) {
            throw new Error(Language.ERROR.ERR_REACHED_MAX_CART_LIMIT);
          }
        } else if (headers.guest_user_id && addToCartDto.guest_id) {
          if (addToCartDto?.service_id) {
            const serviceContainOrNot = getExistingData.filter(
              (item) =>
                item.service_id === addToCartDto.service_id &&
                item.guest_user_id === headers.guest_user_id &&
                item.guest_id,
            );
            if (serviceContainOrNot?.length) {
              throw new Error(Language.ERROR.ERR_GUEST_USER_SERVICE_ID);
            }
          }
          if (addToCartDto?.package_id) {
            const packageContainOrNot = getExistingData.filter(
              (item) =>
                item?.package_id === addToCartDto?.package_id &&
                item.guest_user_id === headers.guest_user_id &&
                item.guest_id,
            );
            if (packageContainOrNot?.length) {
              throw new Error(Language.ERROR.ERR_GUEST_USER_SERVICE_ID);
            }
          }

          const serviceCount = getExistingData.filter(
            (item) =>
              item.guest_user_id === headers.guest_user_id &&
              item.guest_id === addToCartDto.guest_id,
          );
          if (serviceCount.length >= max_service_in_cart) {
            throw new Error(Language.ERROR.ERR_REACHED_MAX_CART_LIMIT);
          }
        }
      }

      // check previously added services have selected slots or not
      const foundServiceWithSlot = getExistingData?.find(
        (obj) => obj.time_from && obj.time_to,
      );

      // check time_to of last service of cart and time_from of incoming service in cart are same
      let sameAppointmentCheck = false;
      let differentStoreService = false;
      let previousServiceWithoutTime = false;

      if (getExistingData?.length) {
        getExistingData?.sort(function (x, y) {
          if (new Date(x.time_from) > new Date(y.time_from)) {
            return 1;
          }
          if (new Date(x.time_from) < new Date(y.time_from)) {
            return -1;
          }
          return 0;
        });

        sameAppointmentCheck = addToCartDto?.time_from
          ? getExistingData[getExistingData.length - 1][
              'time_to'
            ].toString() === addToCartDto?.time_from.toString()
          : false;

        // condition :: previous services without time and incoming has a time
        const servicesWithoutTime = getExistingData.filter(
          (obj) => !obj.time_from && !obj.time_to,
        );

        if (
          servicesWithoutTime.length &&
          addToCartDto.time_from &&
          addToCartDto.time_to
        ) {
          previousServiceWithoutTime = true;
        }

        differentStoreService = getExistingData.find(
          (obj) => obj.store_id !== addToCartDto['store_id'],
        );
      }

      if (differentStoreService && !addToCartDto.error_type) {
        return {
          error_message: Language.ERROR.ERR_DIFFERENT_STORE_SERVICE,
          error_type: 'different_store',
          status: false,
        };
      }

      // || (!foundServiceWithSlot && addToCartDto['time_from'] && addToCartDto['time_to'])
      // if (
      //   (foundServiceWithSlot && !sameAppointmentCheck) ||
      //   previousServiceWithoutTime
      // ) {
      //   return {
      //     error_message: Language.ERROR.ERR_CART_CONFIRMATION,
      //     error_type: 'clear_slots',
      //     status: false,
      //   };
      // }

      let where = '';

      const cart_timer_limit =
        configObj && configObj.value['cart_timer_mins']
          ? +configObj.value['cart_timer_mins']
          : Constant.REDIS.TTL_IN_MIN;

      if (addToCartDto.service_id && !addToCartDto.package_id) {
        where += `service_id = '${addToCartDto.service_id}'`;
      }

      if (addToCartDto.cutter_id) {
        const [cutterData] = await this.cutterScheduleRepository.query(
          `SELECT * FROM public.mv_cutter_schedule where employee_user_id = '${addToCartDto.cutter_id}'`,
        );

        if (cutterData?.status !== 'active') {
          throw new Error(Language.ERROR.ERR_INAVCTIVE_CUTTER);
        }
      }

      if (addToCartDto.package_id) {
        where += `service_id = '${addToCartDto.package_id}'`;
      }

      const [serviceData] = await this.serviceViewRepository.query(
        `SELECT * FROM public.mv_services where ${where}`,
      );

      if (serviceData && serviceData.status !== 'active') {
        throw new Error("You can't book this service. It is not active.");
      }

      let storeData;
      if (addToCartDto.store_id) {
        const currentDay = new Date().getDay();
        const dayName = Constant.WEEK_DAYS[currentDay];
        [storeData] = await this.serviceViewRepository.query(
          `SELECT * FROM public.mv_stores where id = '${addToCartDto.store_id}' AND weekday='${dayName}' AND tenant_id = '${headers.tenant_id}'`,
        );

        if (storeData && storeData.status !== 2) {
          throw new Error(Language.ERROR.ERR_STORE_INACTIVE);
        }
      }

      const ttlTime = await this.appointmentService.getTTLTime(
        headers['tenant_id'],
      );

      // GEt all booked slots from redis
      const allKey = await this.redisService.keys(
        Constant.REDIS.userCartKey + '*',
      );

      let mainBookedSlotsArr = [];
      if (allKey && allKey.length) {
        const bookedSlots = await this.redisService.mget(allKey);
        mainBookedSlotsArr = [].concat(...bookedSlots);
      }

      let slotbookedInDB = null;
      if (addToCartDto.time_from && addToCartDto.time_to) {
        const startDate = moment(addToCartDto.time_from).format(
          Constant.DATE_FORMAT.YMD_HMD_START,
        );
        const endDate = moment(addToCartDto.time_from).format(
          Constant.DATE_FORMAT.YMD_HMD_END,
        );
        const bookedSlotFromDB = await this.getBookedSlots(
          startDate,
          endDate,
          headers['tenant_id'],
        );
        slotbookedInDB = bookedSlotFromDB.find(
          (slot) =>
            ((new Date(addToCartDto.time_from) >= new Date(slot.time_from) &&
              new Date(addToCartDto.time_from) < new Date(slot.time_to)) ||
              (new Date(addToCartDto.time_from) < new Date(slot.time_to) &&
                new Date(addToCartDto.time_to) > new Date(slot.time_from))) &&
            slot['customer_id'] === headers.customer_id,
        );

        mainBookedSlotsArr = [...mainBookedSlotsArr, ...bookedSlotFromDB];
      }
      // check incoming slot is already booked for incoming cutter
      let existingSlot = mainBookedSlotsArr.find((obj) => {
        return (
          ((new Date(addToCartDto.time_from) >= new Date(obj.time_from) &&
            new Date(addToCartDto.time_from) < new Date(obj.time_to)) ||
            (new Date(addToCartDto.time_from) < new Date(obj.time_to) &&
              new Date(addToCartDto.time_to) > new Date(obj.time_from))) &&
          headers['tenant_id'] === obj.tenant_id &&
          obj.customer_id === addToCartDto.customer_id &&
          // obj.customer_id === addToCartDto.customer_id &&
          (!obj.guest_user_id || !obj.guest_id)
        );
      });

      // check for other customer with same data
      const existingSlotForOtherCustomer = mainBookedSlotsArr.find((obj) => {
        return (
          ((new Date(addToCartDto.time_from) >= new Date(obj.time_from) &&
            new Date(addToCartDto.time_from) < new Date(obj.time_to)) ||
            (new Date(addToCartDto.time_from) < new Date(obj.time_to) &&
              new Date(addToCartDto.time_to) > new Date(obj.time_from))) &&
          headers['tenant_id'] === obj.tenant_id &&
          obj.customer_id &&
          obj.customer_id !== addToCartDto.customer_id &&
          obj.cutter_id === addToCartDto.cutter_id &&
          // obj.customer_id === addToCartDto.customer_id &&
          (!obj.guest_user_id || !obj.guest_id)
        );
      });

      if (addToCartDto.guest_user_id || addToCartDto.guest_id) {
        const checkAvilableSlots = mainBookedSlotsArr.find((obj) => {
          return (
            ((new Date(addToCartDto.time_from) >= new Date(obj.time_from) &&
              new Date(addToCartDto.time_from) < new Date(obj.time_to)) ||
              (new Date(addToCartDto.time_from) < new Date(obj.time_to) &&
                new Date(addToCartDto.time_to) > new Date(obj.time_from))) &&
            headers['tenant_id'] === obj.tenant_id &&
            obj.cutter_id === addToCartDto.cutter_id
            //        ||
            // (obj.guest_user_id && obj.guest_user_id === addToCartDto.guest_user_id))
          );
        });
        existingSlot = checkAvilableSlots;
      }

      if (!existingSlot && addToCartDto.customer_id) {
        existingSlot = existingSlotForOtherCustomer;
      }
      // assign another available cutter if incoming cutter is already booked
      // && headers['guest_user_id'] && !headers['customer_id']
      if (existingSlot) {
        const time_from = new Date(addToCartDto.time_from);
        const time_to = new Date(addToCartDto.time_to);
        const timeDifference = this.appointmentService.getTimeDifference(
          time_to,
          time_from,
        );
        const originalDate = +time_from.getDate();
        const originalMonth = +(time_from.getMonth() + 1);

        const manipluatedDate =
          originalDate >= 10 ? originalDate : '0' + originalDate;
        const manipulatedMonth =
          originalMonth >= 10 ? originalMonth : '0' + originalMonth;
        const onlyDate =
          time_from.getFullYear() +
          '-' +
          manipulatedMonth +
          '-' +
          manipluatedDate;

        const [configObj] = await this.franchisorConfigRepository.find({
          where: {
            category: 'appointment_service_config',
            tenant_id: headers.tenant_id,
          },
        });

        const sleeping_time = configObj?.value
          ? +configObj.value['sleeping_time']
          : +Constant.sleeping_time;

        const time_gap_between_slots = configObj?.value
          ? +configObj.value['time_gap_between_slots']
          : +Constant.time_gap_between_slots;

        const storeTimezone = storeData?.timezone.toUpperCase() || 'UTC';
        const tzOffset = Constant.timezones[storeTimezone];
        const storeCurrentDate = moment()
          .tz(tzOffset)
          .format('YYYY-MM-DDTHH:mm:ss');

        const actualStartDate = moment(storeCurrentDate)
          .add(sleeping_time, 'minutes')
          .format(Constant.DATE_FORMAT.YMD_HMD_START_SECOND);

        const { endDate } = await this.calculateDateRange(
          storeData.store_open_time,
          storeData.store_end_time,
          actualStartDate,
          onlyDate,
        );

        const startDate = moment(addToCartDto.time_from).format(
          Constant.DATE_FORMAT.YMD_HMD,
        );

        let bookedSlots = await this.getRedisCartDetails();
        const bookedSlotsFromDB = await this.getBookedSlots(
          startDate,
          endDate,
          headers['tenant_id'],
        );
        bookedSlots = [...bookedSlots, ...bookedSlotsFromDB];

        const cutters = await this.newCheckCutterAvailability(
          'caraousel',
          addToCartDto.store_id,
          startDate,
          endDate,
          +timeDifference,
          +time_gap_between_slots,
          headers.tenant_id,
          +configObj.value['max_slots_caraousel'],
          bookedSlots,
          null,
          null,
          null,
        );

        if (
          cutters?.length &&
          cutters[0].time_from === addToCartDto.time_from &&
          cutters[0].time_to === addToCartDto.time_to
        ) {
          addToCartDto['cutter_id'] = cutters[0].cutter_id;
          addToCartDto['cutter_name'] = cutters[0].cutter_name;
          addToCartDto['cutter_image'] = cutters[0].cutter_image;
          existingSlot = null;
        } else {
          throw new Error(Language.ERROR.ERR_CUTTER_NOT_AVAILABLE);
        }
      }

      // Add expire time with configurable time limit
      const current_time = new Date().getTime();
      const new_time = current_time + Constant.REDIS.expireMinutes * 60 * 1000;
      addToCartDto['expire_time'] = new Date(new_time);

      const endDate = moment()
        .add(+cart_timer_limit, 'minutes')
        .format(Constant.DATE_FORMAT.YMD_THMD);
      addToCartDto['endDate'] = endDate;

      if (slotbookedInDB) {
        existingSlot = slotbookedInDB;
      }

      // // AMP-8423
      if (addToCartDto.appointment_id) {
        const slotKeys =
          Constant.REDIS.editAppointmentSlotKey +
          addToCartDto.appointment_id +
          `_*`;
        const slotsData = await this.redisService.keys(slotKeys);

        if (slotsData?.length) {
          let existingSlotData = await this.redisService.mget(slotsData);
          existingSlotData = [].concat(...existingSlotData);
          if (existingSlotData?.length) {
            for (const slotObj of existingSlotData) {
              const appointmentIndex = existingSlot.findIndex(
                (app) => app.id == slotObj.appointment_id,
              );
              if (appointmentIndex > -1) {
                existingSlot[appointmentIndex]['removeItem'] = true;
              }
              const appointmentServiceIndex = existingSlot.findIndex(
                (app) => app.id == slotObj.appointment_service_id,
              );
              if (appointmentServiceIndex > -1) {
                existingSlot[appointmentServiceIndex]['removeItem'] = true;
              }
              addToCartDto['appointment_service_id'] =
                slotObj.appointment_service_id;
            }

            // bookedAppointments = bookedAppointments.filter(
            //   (o) => !o['removeItem'],
            // );
            // bookedSlot = bookedSlot.filter((o) => !o['removeItem']);
            // addToCartDto['is_edit_appointment'] = true;

            // remove edit appointment keys from redis - 8423
            // for (let k of slotsData) {
            //   this.redisService.del(k);
            // }
          }
        }
      }
      if (existingSlot) {
        if (
          existingSlot?.time_from === addToCartDto.time_from &&
          existingSlot?.time_to === addToCartDto.time_to &&
          existingSlot?.cutter_id !== addToCartDto.cutter_id &&
          existingSlot?.customer_id === addToCartDto['customer_id']
        ) {
          throw new Error(Language.ERROR.ERR_ALREADY_BOOKED);
        } else {
          throw new Error(Language.ERROR.ERR_ALREADYADD_CART);
        }
      } else {
        if (getExistingData) {
          // Check for other store services in the cart. If found then empty the cart
          const foundOtherService = getExistingData.find(
            (obj) => obj.store_id === addToCartDto.store_id,
          );
          if (!foundOtherService) {
            getExistingData = [];
          }

          getExistingData.forEach((obj) => {
            obj['endDate'] = endDate;
          });

          if (
            getExistingData &&
            getExistingData.length > 0 &&
            getExistingData[getExistingData.length - 1]['appointment_id']
          ) {
            addToCartDto['appointment_id'] =
              getExistingData[getExistingData.length - 1]['appointment_id'];
            addToCartDto['is_edit_appointment'] =
              getExistingData[getExistingData.length - 1][
                'is_edit_appointment'
              ];
            addToCartDto['edit_appointment_time'] =
              getExistingData[getExistingData.length - 1][
                'edit_appointment_time'
              ];
            let edit_appointment_item_ids = [];
            edit_appointment_item_ids =
              getExistingData[getExistingData.length - 1][
                'edit_appointment_item_ids'
              ];
            edit_appointment_item_ids.push(addToCartDto.service_id);
            addToCartDto['edit_appointment_item_ids'] =
              edit_appointment_item_ids;
          }
          getExistingData.push(addToCartDto);
          // response = getExistingData;
          // const ttl = await this.redisService.getTtl(key);
          const timeFromCount = getExistingData?.filter(
            (item) => !item.time_from,
          );
          if (timeFromCount?.length === getExistingData?.length) {
            await this.redisService.set(key, getExistingData);
          } else {
            const keyTtlTime = await this.redisService.getTtl(key);
            if (keyTtlTime <= 0) {
              // here
              await this.redisService.set(
                key,
                getExistingData,
                originalTtlTime,
              );
            } else {
              await this.redisService.set(key, getExistingData, keyTtlTime);
            }
            //await this.redisService.set(key, getExistingData, ttlTime);
          }
          //await this.redisService.set(key, getExistingData, ttlTime);
        } else {
          if (addToCartDto.appointment_id) {
            const appointment = await this.appointmentRepository.findOne(
              addToCartDto.appointment_id,
            );
            addToCartDto['is_edit_appointment'] = true;
            addToCartDto['edit_appointment_time'] = await this.removeTimeZone(
              appointment.appointment_time,
            );
            addToCartDto['edit_appointment_item_ids'] = [
              addToCartDto.service_id
                ? addToCartDto.service_id
                : addToCartDto.package_id,
            ];
          }
          // response = [addToCartDto];
          //await this.redisService.set(key, [addToCartDto], ttlTime);
          const timeFromCount = getExistingData.filter(
            (item) => !item.time_from,
          );
          if (timeFromCount?.length === getExistingData?.length) {
            await this.redisService.set(key, [addToCartDto]);
          } else {
            const keyTtlTime = await this.redisService.getTtl(key);
            if (keyTtlTime <= 0) {
              // herer
              await this.redisService.set(key, [addToCartDto], originalTtlTime);
            } else {
              await this.redisService.set(key, [addToCartDto], ttlTime);
            }
          }
        }
      }

      const result = {
        cart_uniq_id: id,
      };

      return result;
    } catch (err) {
      throw err;
    }
  }

  async getCartDetails(headers: any, customerId: string) {
    try {
      const response = {
        data: [],
        cart_summary: {
          grand_total: 0,
          total_duration: 0,
          total_user: 0,
          total_service: 0,
          total_guest_service: 0,
          total_customer_service: 0,
        },
        guests: [],
      };
      this.logger.info(`CustomerJourneyService : Enter getCartDetails Method`);
      this.ECSlogger.info(
        `CustomerJourneyService : Enter getCartDetails Method`,
      );

      if (!headers['tenant_id']) {
        throw new Error(Language.ERROR.ERR_TENANT_ID);
      }

      const key = Constant.REDIS.userCartKey + customerId;
      const getExistingData = (await this.redisService.get(key)) || [];
      // check for guests
      const guestKey = Constant.REDIS.userGuestKey + customerId;
      const guestData = (await this.redisService.get(guestKey)) || [];

      response['guests'] = guestData;

      const finalObj = {};

      if (guestData?.length) {
        for (let i = 0; i < getExistingData?.length; i++) {
          for (let j = 0; j < guestData.length; j++) {
            if (getExistingData[i].guest_id !== guestData[j].guest_id) {
              finalObj[guestData[j].guest_id] = {
                guest_id: guestData[j].guest_id,
                guest_name: guestData[j].guest_name,
                services: [],
              };
              response.cart_summary.total_user += 1;
            }
          }
        }
      }

      const customerCount = getExistingData.filter(
        (item) =>
          (item.customer_id || item.guest_user_id) &&
          (item.service_id || item.package_id) &&
          !item.guest_id,
      );

      const uniqueCustomerServiceLength = [
        ...new Set(
          customerCount.map((item) => item.customer_id || item.guest_user_id),
        ),
      ];

      response.cart_summary.total_customer_service =
        uniqueCustomerServiceLength.length;

      const guestCount = getExistingData.filter(
        (item) => item.guest_id && (item.service_id || item.package_id),
      );

      const uniqueGuestServiceLength = [
        ...new Set(guestCount.map((item) => item.guest_id)),
      ];
      response.cart_summary.total_guest_service =
        uniqueGuestServiceLength.length;

      if (guestData.length != 0 && getExistingData.length === 0) {
        response.cart_summary.total_user += +guestData.length + 1;
      }

      if (getExistingData.length === 0) {
        let customer_name = '';
        const [userData] = await this.customerViewRepository.query(`
          SELECT * FROM mv_customer where customer_id = '${customerId}'
        `);

        if (userData && userData?.fullname) {
          customer_name = `${userData?.fullname}`;
        }

        finalObj[customerId] = {
          customer_id: customerId,
          customer_name: customer_name || '',
          services: [],
        };

        response['data'] = Object.values(finalObj).sort((item: any) =>
          !!item?.guest_id ? 1 : -1,
        );
      }

      if (getExistingData?.length) {
        const checkGuest = getExistingData.filter((item) => !!item.guest_id);
        if (checkGuest?.length == getExistingData?.length) {
          let customer_name = '';
          const [userData] = await this.customerViewRepository.query(`
            SELECT * FROM mv_customer where customer_id = '${customerId}'
          `);

          if (userData && userData?.fullname) {
            customer_name = `${userData?.fullname}`;
          }

          finalObj[customerId] = {
            customer_id: customerId,
            customer_name: customer_name || '',
            services: [],
          };
        }

        getExistingData.sort(function (x, y) {
          if (new Date(x?.time_from) > new Date(y?.time_from)) {
            return 1;
          }
          if (new Date(x?.time_from) < new Date(y?.time_from)) {
            return -1;
          }
          return 0;
        });

        let customer_name = '';
        const [userData] = await this.customerViewRepository.query(`
          SELECT * FROM mv_customer where customer_id = '${customerId}'
        `);

        if (userData && userData?.fullname) {
          customer_name = `${userData?.fullname}`;
        }

        const configObj = await this.appointmentService.getFranchisorConfig(
          headers.tenant_id,
        );

        const store_ids = getExistingData.map((obj) => {
          if (obj?.store_id) {
            return obj.store_id;
          }
        });

        let allStoreData = [];
        if (store_ids?.length) {
          allStoreData = await this.storeDetailRepository.query(
            `SELECT * FROM public.mv_stores where id IN ('${store_ids.join(
              "', '",
            )}')`,
          );
        }

        for (const data of getExistingData) {
          let where = '';
          if (data.package_id) {
            where = `package_id = '${data.package_id}'`;
          } else {
            where = `service_id = '${data.service_id}'`;
          }

          const serviceImage = await this.serviceViewRepository.query(
            `SELECT DISTINCT(service_image_url) FROM public.mv_services where ${where}`,
          );
          data.logo = data.logo ? data.logo : serviceImage[0].service_image_url;
          if (data.logo && headers.domain_name) {
            data.logo = data.logo.service_image_url
              ? data.logo.service_image_url
              : data.logo;
          } else {
            data.logo = configObj['default_service_image'];
          }

          if (data.cutter_profile_image && headers.domain_name) {
            data.cutter_profile_image = data.cutter_profile_image;
          } else {
            data.cutter_profile_image = configObj['default_cutter_image'];
          }

          if (data.cutter_id) {
            const [cutterData] = await this.cutterScheduleRepository.query(
              `SELECT * FROM public.mv_cutter_schedule where employee_user_id = '${data.cutter_id}'`,
            );

            if (cutterData) {
              data[
                'cutter_name'
              ] = `${cutterData?.firstname} ${cutterData?.lastname}`;
              if (cutterData?.image) {
                data['cutter_profile_image'] = cutterData.image;
              }
            }
          }
          data.customer_name = customer_name;

          let timer_start_date;
          let timer_end_date;

          const timeFromCount = getExistingData?.filter(
            (item) => !item.time_from,
          );
          if (timeFromCount?.length === getExistingData?.length) {
            timer_start_date = '';
            timer_end_date = '';
          } else {
            // timer_start_date = moment().format(
            //   Constant.DATE_FORMAT.YMD_THMD,
            // );
            // timer_end_date = data.endDate || '';
            const keyTtlTime = await this.redisService.getTtl(key);
            const minutes = keyTtlTime / 60;
            timer_start_date = moment().format(Constant.DATE_FORMAT.YMD_THMD);
            timer_end_date = moment(timer_start_date)
              .add(minutes, 'minutes')
              .format(Constant.DATE_FORMAT.YMD_THMD);
          }

          // Get store timezone details
          const storeData = allStoreData.find((s) => s.id === data.store_id);

          if (storeData) {
            // assign store timezone
            data['store_timezone_name'] = storeData?.timezone;
            data['store_timezone'] =
              Constant.static_timezone_pair[storeData.timezone.toUpperCase()];
          } else {
            data['store_timezone_name'] = 'GMT';
            data['store_timezone'] = Constant.static_timezone_pair['GMT'];
          }

          const serviceOptionList = data.selectedAddOns;
          data['service_option_duration'] = serviceOptionList?.duration || '';
          data['service_option_id'] = serviceOptionList?.id || '';
          data['service_option_name'] = serviceOptionList?.name || '';
          data['service_option_price'] = serviceOptionList?.price || '';

          // Make object based on customer and guest details
          if (customerId && !data.guest_id) {
            if (
              finalObj[customerId] &&
              finalObj[customerId]['services']?.length
            ) {
              if (+data.discount === 100) {
                response.cart_summary.grand_total += 0;
                finalObj[customerId]['total_amount'] += 0;
              } else {
                response.cart_summary.grand_total +=
                  +data.discounted_price || +data.price;
                finalObj[customerId]['total_amount'] +=
                  +data.discounted_price || +data.price;
              }

              if (+data.service_option_price) {
                response.cart_summary.grand_total += +data.service_option_price;
                finalObj[customerId]['total_amount'] +=
                  +data.service_option_price;
              }

              finalObj[customerId]['appointment_end_time'] = data.time_to;
              // if (data?.time_from && data.time_to) {
              // const minutes = this.utilityService.differenceInMins(
              //   data.time_to,
              //   data.time_from,
              // );
              finalObj[customerId]['total_duration'] += +data.approx_time;
              response.cart_summary.total_duration += +data.approx_time;

              if (
                data.service_option_duration &&
                data.service_option_duration > 0
              ) {
                finalObj[customerId]['total_duration'] +=
                  +data.service_option_duration;
                response.cart_summary.total_duration +=
                  +data.service_option_duration;
              }
              // }

              finalObj[customerId]['services'].push(data);
            } else {
              response.cart_summary.grand_total +=
                +data.discounted_price || +data.price;

              let total_amount = +data.discounted_price || +data.price;

              if (+data.discount === 100) {
                response.cart_summary.grand_total = 0;
                total_amount = 0;
              }

              if (+data.service_option_price) {
                response.cart_summary.grand_total += +data.service_option_price;
                total_amount += +data.service_option_price;
              }

              let total_duration = 0;
              // if (data?.time_from && data.time_to) {
              // const minutes = this.utilityService.differenceInMins(
              //   data.time_to,
              //   data.time_from,
              // );
              total_duration += +data.approx_time;
              response.cart_summary.total_duration += +data.approx_time;

              if (
                +data.service_option_duration &&
                +data.service_option_duration > 0
              ) {
                total_duration += +data.service_option_duration;
                response.cart_summary.total_duration +=
                  +data.service_option_duration;
              }
              // }

              finalObj[customerId] = {
                customer_name: customer_name,
                customer_id: data?.customer_id || '',
                guest_user_id: data?.guest_user_id || '',
                is_for_customer: data.is_for_customer,
                music: data?.music || [],
                beverages: data?.beverages || [],
                instruction: data?.cutter_note || '',
                expire_time: data?.expire_time || '',
                appointment_start_time: data?.time_from || '',
                appointment_end_time: data?.time_to || '',
                cutter_id: data?.cutter_id || '',
                cutter_name: data?.cutter_name,
                cutter_image: data.cutter_profile_image,
                total_amount,
                total_duration,
                timer_start_date,
                timer_end_date,
                cutter_note: data?.cutter_note || '',
                appointment_id:
                  data && data.appointment_id ? data.appointment_id : '',
                is_edit_appointment: data && data.appointment_id ? true : false,
                edit_appointment_time:
                  data && data.edit_appointment_time
                    ? data.edit_appointment_time
                    : '',
                edit_appointment_item_ids:
                  data && data.edit_appointment_item_ids
                    ? data.edit_appointment_item_ids
                    : [],
                services: [data],
                rebook_cutter_id:
                  data && data.rebook_cutter_id ? data.rebook_cutter_id : '',
                rebook_cutter_status:
                  data && data.rebook_cutter_status
                    ? data.rebook_cutter_status
                    : '',
              };
            }
          } else if (customerId && data.guest_id) {
            if (
              finalObj[data.guest_id.toLowerCase()] &&
              finalObj[data.guest_id.toLowerCase()]['services']?.length
            ) {
              response.cart_summary.grand_total +=
                +data.discounted_price || +data.price;
              finalObj[data.guest_id]['total_amount'] +=
                +data.discounted_price || +data.price;

              if (+data.service_option_price) {
                response.cart_summary.grand_total += +data.service_option_price;
                finalObj[data.guest_id]['total_amount'] +=
                  +data.service_option_price;
              }

              finalObj[data.guest_id]['appointment_end_time'] = data.time_to;

              // const minutes = this.utilityService.differenceInMins(
              //   data.time_to,
              //   data.time_from,
              // );
              finalObj[data.guest_id]['total_duration'] += +data.approx_time;
              response.cart_summary.total_duration += +data.approx_time;

              if (
                +data.service_option_duration &&
                +data.service_option_duration > 0
              ) {
                finalObj[data.guest_id]['total_duration'] +=
                  +data.service_option_duration;
                response.cart_summary.total_duration +=
                  +data.service_option_duration;
              }

              finalObj[data.guest_id]['services'].push(data);
            } else {
              response.cart_summary.grand_total +=
                +data.discounted_price || +data.price;

              let guest_total_amount = +data.discounted_price || +data.price;

              if (+data.service_option_price) {
                response.cart_summary.grand_total += +data.service_option_price;
                guest_total_amount += +data.service_option_price;
              }

              let total_duration = 0;
              // const minutes = this.utilityService.differenceInMins(
              //   data.time_to,
              //   data.time_from,
              // );
              total_duration += +data.approx_time;
              response.cart_summary.total_duration += +data.approx_time;

              if (
                +data.service_option_duration &&
                +data.service_option_duration > 0
              ) {
                total_duration += +data.service_option_duration;
                response.cart_summary.total_duration +=
                  +data.service_option_duration;
              }

              finalObj[data.guest_id] = {
                guest_id: data.guest_id,
                guest_name: data.guest_name,
                customer_id: data?.customer_id || '',
                guest_user_id: data?.guest_user_id || '',
                music: data?.music || [],
                is_for_customer: data.is_for_customer,
                beverages: data?.beverages || [],
                instruction: '',
                expire_time: data?.expire_time || '',
                appointment_start_time: data?.time_from || '',
                appointment_end_time: data?.time_to || '',
                cutter_id: data?.cutter_id || '',
                cutter_name: data?.cutter_name,
                cutter_image: data.cutter_profile_image,
                total_amount: guest_total_amount,
                total_duration,
                timer_start_date,
                timer_end_date,
                cutter_note: data?.cutter_note || '',
                appointment_id:
                  data && data.appointment_id ? data.appointment_id : '',
                is_edit_appointment: data && data.appointment_id ? true : false,
                edit_appointment_time:
                  data && data.edit_appointment_time
                    ? data.edit_appointment_time
                    : '',
                edit_appointment_item_ids:
                  data && data.edit_appointment_item_ids
                    ? data.edit_appointment_item_ids
                    : [],
                services: [data],
              };
            }
          } else if (data.guest_user_id && !data.guest_id) {
            if (
              finalObj[data.guest_user_id.toLowerCase()] &&
              finalObj[data.guest_user_id.toLowerCase()]['services']?.length
            ) {
              response.cart_summary.grand_total +=
                +data.discounted_price || +data.price;
              finalObj[data.guest_user_id]['total_amount'] +=
                +data.discounted_price || +data.price;

              if (+data.service_option_price) {
                response.cart_summary.grand_total += +data.service_option_price;
                finalObj[data.guest_user_id]['total_amount'] +=
                  +data.service_option_price;
              }

              finalObj[data.guest_user_id]['appointment_end_time'] =
                data.time_to;

              finalObj[data.guest_user_id]['total_duration'] +=
                +data.approx_time;
              response.cart_summary.total_duration += +data.approx_time;

              // const minutes = this.utilityService.differenceInMins(
              //   data.time_to,
              //   data.time_from,
              // );
              finalObj[data.guest_user_id]['total_duration'] +=
                +data.approx_time;
              response.cart_summary.total_duration += +data.approx_time;

              if (
                data.service_option_duration &&
                data.service_option_duration > 0
              ) {
                finalObj[data.guest_user_id]['total_duration'] +=
                  +data.service_option_duration;
                response.cart_summary.total_duration +=
                  +data.service_option_duration;
              }

              finalObj[data.guest_user_id]['services'].push(data);
            } else {
              response.cart_summary.grand_total +=
                +data.discounted_price || +data.price;

              let guest_total_amount = +data.discounted_price || +data.price;

              if (+data.service_option_price) {
                response.cart_summary.grand_total += +data.service_option_price;
                guest_total_amount += +data.service_option_price;
              }

              let total_duration = 0;
              // const minutes = this.utilityService.differenceInMins(
              //   data.time_to,
              //   data.time_from,
              // );
              total_duration += +data.approx_time;
              response.cart_summary.total_duration += +data.approx_time;
              if (
                +data.service_option_duration &&
                +data.service_option_duration > 0
              ) {
                total_duration += +data.service_option_duration;
                response.cart_summary.total_duration +=
                  +data.service_option_duration;
              }

              finalObj[data.guest_user_id] = {
                guest_name: data.guest_name,
                customer_id: data?.customer_id || '',
                guest_user_id: data?.guest_user_id || '',
                music: data?.music || [],
                is_for_customer: data.is_for_customer,
                beverages: data?.beverages || [],
                instruction: '',
                expire_time: data?.expire_time || '',
                appointment_start_time: data?.time_from || '',
                appointment_end_time: data?.time_to || '',
                cutter_id: data?.cutter_id || '',
                cutter_image: data.cutter_profile_image,
                total_amount: guest_total_amount,
                total_duration,
                timer_start_date,
                timer_end_date,
                cutter_note: data?.cutter_note || '',
                services: [data],
              };
            }
          } else if (data.guest_user_id && data.guest_id) {
            if (
              finalObj[data.guest_id.toLowerCase()] &&
              finalObj[data.guest_id.toLowerCase()]['services']?.length
            ) {
              response.cart_summary.grand_total +=
                +data.discounted_price || +data.price;
              finalObj[data.guest_id]['total_amount'] +=
                +data.discounted_price || +data.price;

              if (+data.service_option_price) {
                response.cart_summary.grand_total += +data.service_option_price;
                finalObj[data.guest_id]['total_amount'] +=
                  +data.service_option_price;
              }

              finalObj[data.guest_id]['appointment_end_time'] = data.time_to;

              // const minutes = this.utilityService.differenceInMins(
              //   data.time_to,
              //   data.time_from,
              // );
              finalObj[data.guest_id]['total_duration'] += +data.approx_time;
              response.cart_summary.total_duration += +data.approx_time;

              if (
                data.service_option_duration &&
                data.service_option_duration > 0
              ) {
                finalObj[data.guest_id]['total_duration'] +=
                  +data.service_option_duration;
                response.cart_summary.total_duration +=
                  +data.service_option_duration;
              }

              finalObj[data.guest_id]['services'].push(data);
            } else {
              response.cart_summary.grand_total +=
                +data.discounted_price || +data.price;

              let guest_total_amount = +data.discounted_price || +data.price;

              if (+data.service_option_price) {
                response.cart_summary.grand_total += +data.service_option_price;
                guest_total_amount += +data.service_option_price;
              }

              let total_duration = 0;

              // const minutes = this.utilityService.differenceInMins(
              //   data.time_to,
              //   data.time_from,
              // );
              total_duration += +data.approx_time;
              response.cart_summary.total_duration += +data.approx_time;
              if (
                +data.service_option_duration &&
                +data.service_option_duration > 0
              ) {
                total_duration += +data.service_option_duration;
                response.cart_summary.total_duration +=
                  +data.service_option_duration;
              }

              finalObj[data.guest_id] = {
                guest_name: data.guest_name,
                customer_id: data?.customer_id || '',
                guest_user_id: data?.guest_user_id || '',
                music: data?.music || [],
                is_for_customer: data.is_for_customer,
                beverages: data?.beverages || [],
                instruction: '',
                expire_time: data?.expire_time || '',
                appointment_start_time: data?.time_from || '',
                appointment_end_time: data?.time_to || '',
                cutter_id: data?.cutter_id || '',
                cutter_image: data.cutter_profile_image,
                total_amount: guest_total_amount,
                total_duration,
                timer_start_date,
                timer_end_date,
                cutter_note: data?.cutter_note || '',
                services: [data],
              };
            }
          }
        }
        // Commented for not showing uniques service, package count added in cart

        // const uniqueServiceLength = [
        //   ...new Set(getExistingData.map((item) => item.service_id)),
        // ];

        // const unique = function (arr, keyProps) {
        //   const kvArray = arr.map((entry) => {
        //     const key = keyProps.map((k) => entry[k]).join('|');
        //     return [key, entry];
        //   });
        //   const map = new Map(kvArray);
        //   return Array.from(map.values());
        // };
        // const uniqueServiceLength = unique(getExistingData, [
        //   'service_id',
        //   'package_id',
        // ]).length;

        // response.cart_summary.total_service = uniqueServiceLength;

        response.cart_summary.total_service = getExistingData.length;

        response['data'] = Object.values(finalObj).sort((item: any) =>
          !!item?.guest_id ? 1 : -1,
        );
        response.cart_summary.total_user = Object.values(finalObj).length;
      } else {
        if (guestData.length) {
          for (const guest of guestData) {
            const objToPush = {
              guest_id: guest.guest_id,
              guest_name: guest.guest_name,
              services: [],
            };
            response.data.push(objToPush);
          }
        }
      }
      return response;
    } catch (err) {
      throw err;
    }
  }

  async updateCartDetails(req: any, updateCartDto: UpdateCartDto) {
    // Below conditions should be satisfied
    //diff guest - same cutter - fail
    // diff cust - diff cutter - same slot - pass
    // diff guest - diff cutter - pass
    // diff cust - same cutter - same slot - fail
    // same cutter - same time -  simultaneously - one guest - one user(log in) - fail
    try {
      this.logger.info(
        `CustomerJourneyService : Enter updateCartDetails Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter updateCartDetails Method`,
      );

      const [configObj] = await this.franchisorConfigRepository.find({
        where: {
          category: 'appointment_service_config',
          tenant_id: req.headers.tenant_id,
        },
      });

      const cart_timer_limit =
        configObj && configObj.value['cart_timer_mins']
          ? +configObj.value['cart_timer_mins']
          : Constant.REDIS.TTL_IN_MIN;

      const originalRedisTTL =
        configObj && configObj.value['cart_timer_mins']
          ? +configObj.value['cart_timer_mins'] * 60
          : Constant.REDIS.TTL;

      const key = Constant.REDIS.userCartKey + updateCartDto.cart_uniq_id;
      const data = await this.redisService.get(key);

      const finalCartArray = [];
      if (data?.length) {
        // check for continuationa and overlapping selected time slots
        const newObj = [];
        const allNewCutterSlots = updateCartDto.cart_details.map((obj) => {
          return {
            time_from: obj.time_from,
            time_to: obj.time_to,
            cutter_id: obj.cutter_id,
          };
        });

        const redisTtl = await this.redisService.getTtl(key);
        if (redisTtl <= 0) {
          await this.redisService.set(key, data, originalRedisTTL);
        }

        allNewCutterSlots.sort(function (x, y) {
          if (new Date(x.time_from) > new Date(y.time_from)) {
            return 1;
          }
          if (new Date(x.time_from) < new Date(y.time_from)) {
            return -1;
          }
          return 0;
        });

        let lastSlot;
        for (const cutter of allNewCutterSlots) {
          if (newObj.length) {
            // find same object in newObj
            const foundCutters = newObj.filter(
              (ca) => ca.cutter_id === cutter.cutter_id,
            );
            if (foundCutters && foundCutters.length) {
              for (const fc of foundCutters) {
                // check slot is overlappoing
                const overlap =
                  new Date(fc.time_from) >= new Date(cutter.time_from) &&
                  new Date(cutter.time_to) <= new Date(fc.time_to);

                if (overlap) {
                  throw new Error(Language.ERROR.ERR_SLOT_CONTINUATION);
                }

                // check continuation
                const continueSlot = fc.time_to === cutter.time_from;
                if (continueSlot) {
                  lastSlot = cutter;
                  newObj.push(cutter);
                  break;
                } else {
                  throw new Error(Language.ERROR.ERR_SLOT_CONTINUATION);
                }
              }
            } else {
              const continueCOnd = lastSlot?.time_to === cutter?.time_from;
              const overlapCOnd =
                (new Date(cutter.time_from) >= new Date(lastSlot.time_from) &&
                  new Date(cutter.time_to) <= new Date(lastSlot.time_to)) ||
                (new Date(cutter.time_from) >= new Date(lastSlot.time_from) &&
                  new Date(cutter.time_from) <= new Date(lastSlot.time_to));

              if (continueCOnd || overlapCOnd) {
                lastSlot = cutter;
                newObj.push(cutter);
              } else {
                throw new Error(Language.ERROR.ERR_SLOT_CONTINUATION);
              }
            }
          } else {
            lastSlot = cutter;
            newObj.push(cutter);
          }
        }

        // fetch customer cart data
        const customersCart = data.filter(
          (obj) => obj.customer_id && !obj.guest_user_id && !obj.guest_id,
        );
        const guestCart = data.filter(
          (obj) => obj.guest_user_id && !obj.guest_id,
        );

        const actualGuestCart = data.filter((obj) => obj.guest_id);
        for (const updateCartObj of updateCartDto.cart_details) {
          let redisCartDetails = await this.getRedisCartDetails();
          const startDate = moment(updateCartObj['time_from']).format(
            Constant.DATE_FORMAT.YMD_HMD_START,
          );
          const endDate = moment(updateCartObj['time_from']).format(
            Constant.DATE_FORMAT.YMD_HMD_END,
          );
          const bookedSlotsFromDB = await this.getBookedSlots(
            startDate,
            endDate,
            req.headers.tenant_id,
          );
          redisCartDetails = [...redisCartDetails, ...bookedSlotsFromDB];

          // AMP-8645
          if (updateCartDto.appointment_id) {
            const slotKeys =
              Constant.REDIS.editAppointmentSlotKey +
              updateCartDto.appointment_id +
              `_*`;
            const slotsData = await this.redisService.keys(slotKeys);

            if (slotsData?.length) {
              let slotsToRemove = await this.redisService.mget(slotsData);
              slotsToRemove = [].concat(...slotsToRemove);

              // for (let slotObj of slotsToRemove) {

              // }

              redisCartDetails = redisCartDetails.filter(
                (obj) => obj.appointment_id !== updateCartDto.appointment_id,
              );
            } else {
              redisCartDetails = redisCartDetails.filter(
                (obj) => obj.appointment_id !== updateCartDto.appointment_id,
              );
            }
          }

          if (redisCartDetails?.length) {
            for (const existingCartObj of redisCartDetails) {
              const customerCond =
                existingCartObj.customer_id &&
                updateCartObj.customer_id &&
                existingCartObj.customer_id === updateCartObj.customer_id;
              const guestUserCond =
                (existingCartObj.guest_user_id &&
                  updateCartObj.guest_user_id &&
                  existingCartObj.guest_user_id ===
                    updateCartObj.guest_user_id) ||
                existingCartObj.cutter_id === updateCartObj.cutter_id;

              const actualGuestCond =
                existingCartObj.guest_id &&
                updateCartObj.guest_id &&
                existingCartObj.guest_id === updateCartObj.guest_id;
              // if (existingCartObj.cutter_id === updateCartObj.cutter_id) {
              if (
                ((new Date(updateCartObj['time_from']) >=
                  new Date(existingCartObj.time_from) &&
                  new Date(updateCartObj['time_to']) <=
                    new Date(existingCartObj.time_to)) ||
                  (new Date(updateCartObj['time_to']) >
                    new Date(existingCartObj.time_from) &&
                    new Date(updateCartObj['time_from']) <
                      new Date(existingCartObj.time_to))) &&
                ((customerCond &&
                  !updateCartObj.guest_id &&
                  !existingCartObj.guest_id) ||
                  guestUserCond ||
                  actualGuestCond)
              ) {
                if (existingCartObj.customer_id === updateCartObj.customer_id) {
                  throw new Error(Language.ERROR.ERR_ALREADY_BOOKED);
                } else {
                  if (updateCartObj.guest_id) {
                    throw new Error(Language.ERROR.ERR_ALREADYADD_GUEST_CART);
                  }
                  if (
                    updateCartObj.customer_id ||
                    updateCartObj.guest_user_id
                  ) {
                    throw new Error(Language.ERROR.ERR_ALREADYADD_YOU_CART);
                  }
                }
              }
              // }
            }
          }

          if (customersCart?.length && updateCartObj.customer_id) {
            let newTimeFrom = updateCartObj['time_from'];
            // if multipler service is there then assign slots according to duration of the service
            for (const cartObj of customersCart) {
              let duration = +cartObj['approx_time'];
              if (+cartObj?.service_option_duration) {
                duration += +cartObj?.service_option_duration;
              }

              const newTimeTo = moment(newTimeFrom)
                .add(duration, 'minutes')
                .format(Constant.DATE_FORMAT.YMD_THMD);

              // check whether to update timer or not
              if (cartObj['time_from'] !== newTimeFrom) {
                const endDate = moment()
                  .add(+cart_timer_limit, 'minutes')
                  .format(Constant.DATE_FORMAT.YMD_THMD);
                cartObj['endDate'] = endDate;
              }

              // Assign time from and time to dynamically
              cartObj['time_from'] = newTimeFrom;
              cartObj['time_to'] = newTimeTo;
              newTimeFrom = newTimeTo;

              cartObj['cutter_id'] = updateCartObj.cutter_id;
              cartObj['cutter_name'] = updateCartObj.cutter_name;
              cartObj['cutter_image'] = updateCartObj.cutter_image;
              cartObj['is_cutter_recommended'] = 0;
            }
            finalCartArray.push(...customersCart);
          }

          if (guestCart?.length && updateCartObj.guest_user_id) {
            const particularGuestCart = guestCart.filter(
              (guestObj) =>
                // guestObj.guest_name.toLowerCase() === updateCartObj.guest_name,
                guestObj.guest_user_id === updateCartObj.guest_user_id,
            );
            if (particularGuestCart?.length) {
              let newTimeFrom = updateCartObj['time_from'];
              // if multipler service is there then assign slots according to duration of the service
              for (const cartObj of particularGuestCart) {
                let duration = +cartObj['approx_time'];
                if (+cartObj?.service_option_duration) {
                  duration += +cartObj?.service_option_duration;
                }
                const newTimeTo = moment(newTimeFrom)
                  .add(duration, 'minutes')
                  .format(Constant.DATE_FORMAT.YMD_THMD);

                // check whether to update timer or not
                if (cartObj['time_from'] !== newTimeFrom) {
                  const endDate = moment()
                    .add(+cart_timer_limit, 'minutes')
                    .format(Constant.DATE_FORMAT.YMD_THMD);
                  cartObj['endDate'] = endDate;
                }

                // Assign time from and time to dynamically
                cartObj['time_from'] = newTimeFrom;
                cartObj['time_to'] = newTimeTo;
                newTimeFrom = newTimeTo;

                cartObj['cutter_id'] = updateCartObj.cutter_id;
                cartObj['cutter_name'] = updateCartObj.cutter_name;
                cartObj['cutter_image'] = updateCartObj.cutter_image;
                cartObj['is_cutter_recommended'] = 0;
              }
            }
            finalCartArray.push(...particularGuestCart);
          }

          if (actualGuestCart?.length && updateCartObj.guest_id) {
            const particularActualGuestCart = actualGuestCart.filter(
              (guest) => guest.guest_id === updateCartObj.guest_id,
            );
            if (particularActualGuestCart) {
              let newTimeFrom = updateCartObj['time_from'];
              // if multipler service is there then assign slots according to duration of the service
              for (const cartObj of particularActualGuestCart) {
                let duration = +cartObj['approx_time'];
                if (+cartObj?.service_option_duration) {
                  duration += +cartObj?.service_option_duration;
                }
                const newTimeTo = moment(newTimeFrom)
                  .add(duration, 'minutes')
                  .format(Constant.DATE_FORMAT.YMD_THMD);

                // check whether to update timer or not
                if (cartObj['time_from'] !== newTimeFrom) {
                  const endDate = moment()
                    .add(+cart_timer_limit, 'minutes')
                    .format(Constant.DATE_FORMAT.YMD_THMD);
                  cartObj['endDate'] = endDate;
                }

                // Assign time from and time to dynamically
                cartObj['time_from'] = newTimeFrom;
                cartObj['time_to'] = newTimeTo;
                newTimeFrom = newTimeTo;

                cartObj['cutter_id'] = updateCartObj.cutter_id;
                cartObj['cutter_name'] = updateCartObj.cutter_name;
                cartObj['cutter_image'] = updateCartObj.cutter_image;
                cartObj['is_cutter_recommended'] = 0;
              }
            }
            finalCartArray.push(...particularActualGuestCart);
          }
        }

        const ttl = await this.redisService.getTtl(key);
        const timeFromCount = finalCartArray?.filter((item) => !item.time_from);
        if (timeFromCount?.length === finalCartArray?.length) {
          await this.redisService.set(key, finalCartArray);
        } else {
          await this.redisService.set(key, finalCartArray, ttl);
        }
        //await this.redisService.set(key, finalCartArray, ttl);
      } else {
        throw new Error(Language.ERROR.ERR_CART_NOT_FOUND);
      }
      const response = {
        message: Language.SUCESS.MSG_CART_UPDATE,
      };
      return response;
    } catch (err) {
      throw err;
    }
  }

  async getStoreDetailAPI(storeId: string, headers: any, queryParams: any) {
    try {
      this.logger.info(`storeDetailsAPi : Enter getStoreDetailAPI Method`);
      this.ECSlogger.info(`storeDetailsAPi : Enter getStoreDetailAPI Method`);

      let is_store_favourite = false;
      if (headers?.customer_id) {
        const [customerPreference] = await this.customerViewRepository.query(`
            SELECT * FROM mv_customer WHERE customer_id = '${headers.customer_id}'
          `);
        if (customerPreference && customerPreference?.fav_stores) {
          const storeIds = customerPreference?.fav_stores.map(
            (obj) => obj.store_id,
          );
          if (storeIds.length && storeIds.indexOf(storeId) >= 0) {
            is_store_favourite = true;
          }
        }
      }
      const query = `
        SELECT DISTINCT(weekday, store_open_time) as seperator,
          id,
          name,
          primary_contact as contact,
          geo_lat,
          geo_long,
          logo,
          timezone,
          address,
          street_name,
          suite_number,
          city,
          state,
          zipcode,
          store_open_time,
          store_end_time,
          weekday,
          country,
          timezone,concat('2021-01-01 ',store_open_time)::timestamp as finalDate,
          status
        FROM public.mv_stores where id = '${storeId}' ORDER BY finalDate ASC
      `;

      const allStoreObjs = await this.storeDetailRepository.query(query);

      if (!allStoreObjs && allStoreObjs.length === 0) {
        throw new Error(Language.ERROR.ERR_STORE_NOT_FOUND);
      }

      const storeTimezone = allStoreObjs[0].timezone || 'GMT';
      const tzOffset = Constant.timezones[storeTimezone];
      const currentTime = moment()
        .tz(tzOffset)
        .format(Constant.DATE_FORMAT.YMD);
      const currentDay = new Date(currentTime).getDay();
      const dayName = Constant.WEEK_DAYS[currentDay];
      const currentWeekDay = dayName;

      const matchedStoreArray = allStoreObjs.filter(
        (obj) => obj.weekday === currentWeekDay,
      );

      const storeData = matchedStoreArray[0];
      const shifts = [];
      let is_opened = false;
      for (const obj of matchedStoreArray) {
        if (obj.store_open_time && obj.store_end_time) {
          const dateDifferenceObj = await this.calculateDateDifference(
            obj.store_open_time,
            obj.store_end_time,
            currentTime,
            storeTimezone,
          );
          if (
            moment(dateDifferenceObj.storeCurrentDate).isAfter(
              moment(dateDifferenceObj.startTime),
            ) &&
            moment(dateDifferenceObj.storeCurrentDate).isBefore(
              moment(dateDifferenceObj.endTime),
            )
          ) {
            is_opened = true;
          }
          shifts.push({
            store_open_time: obj.store_open_time,
            store_end_time: obj.store_end_time,
          });
        }
      }

      // Get presigned_url of store images/logo
      const store_image = await this.getImage(
        storeData?.logo,
        headers.tenant_id,
      );

      let getTravelTime;
      //Check show_time_to_reach for call google matrix api
      /*if (
        queryParams?.show_time_to_reach &&
        queryParams?.show_time_to_reach.toLowerCase() === 'true'
      ) {
        if (queryParams?.lat && queryParams?.long) {
          getTravelTime = await this.getEstimatedTime(
            queryParams.lat,
            queryParams.long,
            storeData['geo_lat'],
            storeData['geo_long'],
          );
        }
      }*/
      let status = 'active';
      if (storeData.status === 1) {
        status = 'pending';
      }

      if (storeData.status === 3) {
        status = 'inactive';
      }

      const response = {
        store_details: {
          store_id: storeData?.id,
          store_name: storeData?.name,
          contact: storeData?.contact,
          store_current_time: moment()
            .tz(tzOffset)
            .format(Constant.DATE_FORMAT.YMD_THMD),
          timezone: storeData?.timezone,
          store_image,
          geo_lat: storeData?.geo_lat,
          geo_long: storeData?.geo_long,
          distance: '',
          address: storeData?.address,
          street_name: storeData?.street_name,
          suite_number: storeData?.suite_number,
          city: storeData?.city,
          state: storeData?.state,
          zipcode: storeData?.zipcode,
          is_store_favourite,
          store_open_time: storeData?.store_open_time,
          store_end_time: storeData?.store_end_time,
          weekday: storeData?.weekday,
          country: storeData?.country,
          shifts,
          is_opened,
          status,
        },
      };

      this.logger.info(`storeDetailsAPi : Exit getStoreDetailAPI Method`);
      this.ECSlogger.info(`storeDetailsAPi : Exit getStoreDetailAPI Method`);

      return response;
    } catch (err) {
      throw err;
    }
  }

  async addInstruction(
    addInstructionDto: CJAddInstructionDto,
    customer_id,
    guest_user_id,
  ) {
    try {
      this.logger.info(`CustomerJourneyService : Enter addInstruction Method`);
      this.ECSlogger.info(
        `CustomerJourneyService : Enter addInstruction Method`,
      );

      const key = Constant.REDIS.userCartKey + addInstructionDto.cart_uniq_id;

      const cartData = await this.redisService.get(key);

      if (cartData?.length) {
        for (let i = 0; i < cartData.length; i++) {
          if (customer_id && addInstructionDto?.guest_id) {
            if (
              customer_id === cartData[i].customer_id &&
              addInstructionDto?.guest_id === cartData[i].guest_id
            ) {
              cartData[i]['cutter_note'] = addInstructionDto['cutter_note'];
            }
          } else if (customer_id && !addInstructionDto?.guest_id) {
            if (
              customer_id === cartData[i].customer_id &&
              !cartData[i].guest_id
            ) {
              cartData[i]['cutter_note'] = addInstructionDto['cutter_note'];
            }
          } else if (guest_user_id && addInstructionDto?.guest_id) {
            if (
              guest_user_id === cartData[i].guest_user_id &&
              addInstructionDto?.guest_id === cartData[i].guest_id
            ) {
              cartData[i]['cutter_note'] = addInstructionDto['cutter_note'];
            }
          } else if (guest_user_id && !addInstructionDto?.guest_id) {
            if (
              guest_user_id === cartData[i].guest_user_id &&
              addInstructionDto?.guest_id === cartData[i].guest_id
            ) {
              cartData[i]['cutter_note'] = addInstructionDto['cutter_note'];
            }
          }
        }

        // // save instruction
        const ttl = await this.redisService.getTtl(key);
        await this.redisService.set(key, cartData, ttl);

        this.logger.info(`CustomerJourneyService : Exit addInstruction Method`);
        this.ECSlogger.info(
          `CustomerJourneyService : Exit addInstruction Method`,
        );

        return;
      } else {
        throw new Error(Language.ERROR.ERR_CART_NOT_FOUND);
      }
    } catch (err) {
      throw err;
    }
  }

  async confirmAppointment(
    headers: any,
    confirmAppointmentDto: CJAppointmentConfirmDto,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter confirmAppointment Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter confirmAppointment Method`,
      );

      const id = headers.customer_id || headers.guest_user_id;
      const key = Constant.REDIS.userCartKey + id;

      const getExistingData = await this.redisService.get(key);

      if (!getExistingData || getExistingData?.length === 0) {
        throw new Error(Language.ERROR.ERR_CART_NOT_FOUND);
      }

      getExistingData.sort(function (x, y) {
        if (new Date(x?.time_from) > new Date(y?.time_from)) {
          return 1;
        }
        if (new Date(x?.time_from) < new Date(y?.time_from)) {
          return -1;
        }
        return 0;
      });

      // check if any service booked from carousel
      // TODO:: amp-5291 uncomment below code
      // const serviceFromCarousel = getExistingData.find(
      //   (obj) => obj.is_from_carousel,
      // );

      // const serviceWithoutCarousel = getExistingData.find(
      //   (obj) => obj.is_from_carousel === 0,
      // );

      // if (
      //   serviceFromCarousel &&
      //   serviceWithoutCarousel &&
      //   !confirmAppointmentDto.service_id
      // ) {
      //   return {
      //     error_message: Language.ERROR.ERR_BOOK_APPOINTMENT_POPUP,
      //     error_type: 'service_carousel_feature',
      //     status: false,
      //     service_id: serviceWithoutCarousel.service_id,
      //   };
      // }

      // // if service id comes in body then remove it from existing cart
      // if (confirmAppointmentDto.service_id) {
      //   const foundIndex = getExistingData.findIndex(
      //     (obj) => obj.service_id === confirmAppointmentDto.service_id,
      //   );
      //   if (foundIndex !== -1) {
      //     getExistingData.splice(foundIndex, 1);
      //   }
      // }

      // amp-5929 (i booked service from portal after login and from another window i'm bokking service from carousel for same time slot then throw an error)
      if (getExistingData?.length && headers.customer_id) {
        const startDate = moment(getExistingData[0].time_from).format(
          Constant.DATE_FORMAT.YMD_HMD_START,
        );
        const endDate = moment(
          getExistingData[getExistingData.length - 1].time_to,
        ).format(Constant.DATE_FORMAT.YMD_HMD_END);
        const bookedSlotsFromDB = await this.getBookedSlotsByUser(
          startDate,
          endDate,
          headers.tenant_id,
          headers.customer_id,
        );
        for (const bookedSlot of getExistingData) {
          const slotIsFromDB = bookedSlotsFromDB.find(
            (slot) =>
              (new Date(bookedSlot.time_from) >= new Date(slot.time_from) &&
                new Date(bookedSlot.time_from) < new Date(slot.time_to)) ||
              (new Date(bookedSlot.time_from) < new Date(slot.time_to) &&
                new Date(bookedSlot.time_to) > new Date(slot.time_from)),
          );

          const customerCond =
            slotIsFromDB &&
            bookedSlot.customer_id &&
            bookedSlot.customer_id === slotIsFromDB.customer_id;
          const guestCond =
            slotIsFromDB &&
            bookedSlot.guest_id &&
            bookedSlot.guest_id === slotIsFromDB.guest_id;
          if (
            slotIsFromDB &&
            ((customerCond && !bookedSlot.guest_id && !slotIsFromDB.guest_id) ||
              guestCond)
          ) {
            throw new Error(Language.ERROR.ERR_ALREADY_BOOKED);
          }
        }
      }
      //Get service id or package id from the cart
      const service_id_list = [];
      let service_id;
      getExistingData.forEach(function (itemList) {
        service_id = itemList?.package_id
          ? itemList?.package_id
          : itemList?.service_id;
        service_id_list.push(service_id);
      });

      //Get service status
      if (service_id_list.length) {
        const serviceIdValue = service_id_list.join("', '");
        const serviceData = await this.serviceViewRepository.query(
          `SELECT DISTINCT(service_id),status FROM public.mv_services where service_id IN('${serviceIdValue}')`,
        );
        //Check the inactive service in the cart
        let serviceSlotsIndex;
        for (const serviceItem of serviceData) {
          if (serviceItem.status !== 'active') {
            serviceSlotsIndex = getExistingData.findIndex((obj) => {
              return (
                obj.service_id === serviceItem.service_id ||
                obj.package_id === serviceItem.service_id
              );
            });
            getExistingData.splice(serviceSlotsIndex, 1);
            if (!getExistingData || getExistingData?.length === 0) {
              throw new Error(Language.ERROR.ERR_CART_SERVICE_INACTIVE);
            }
          }
        }
      }

      // const secretValue = await this.utilityService.upAWSSecrets(
      //   headers['domain_name'],
      // );

      // const configObj = await this.appointmentService.getFranchisorConfig(
      //   headers['domain_name'],
      // );

      // get customer's - guest's latest name
      // const customer_name = '';
      // let guest_user_name = '';

      let userData = null;
      if (headers.customer_id) {
        userData = await this.customerUserRepository.findOne({
          relations: ['customer_preference'],
          where: [
            {
              id: headers.customer_id,
            },
          ],
        });
      }
      if (headers.guest_user_id) {
        userData = await this.customerGuestUserRepository.findOne(
          headers.guest_user_id,
        );
      }

      const appointmentObj = {};
      let firstIndex = 0;

      getExistingData.reduce((acc, obj, index) => {
        const found = acc.findIndex(
          (ac) =>
            new Date(ac.time_to).getTime() ===
              new Date(obj.time_from).getTime() ||
            (new Date(obj.time_from) >= new Date(ac.time_from) &&
              new Date(obj.time_to) <= new Date(ac.time_to) &&
              obj.guest_name),
        );
        if (found != -1) {
          acc.push(obj);
          appointmentObj[firstIndex].push(getExistingData[index]);
          return acc;
        } else {
          acc.push(obj);
          appointmentObj[index] = [getExistingData[index]];
          firstIndex = index;
          return acc;
        }
      }, []);

      const franchisorData = await this.franchisorRepository.findOne(
        headers.tenant_id,
      );
      const notificationCategory =
        await this.notificationCategoryRepository.findOne({
          category: AppointmentEnum.BOOK_APPOINTMENT,
        });
      const notificationTypes = await this.notificationTypeRepository.find();

      let storeData;
      let foundStore = true;
      const response = {
        store_details: {},
        appointments: [],
      };
      const totalAppointments: any = Object.values(appointmentObj);
      if (totalAppointments && totalAppointments.length) {
        const customerConfigObj = await this.franchisorConfigRepository.findOne(
          {
            where: {
              category: 'customer_config',
              tenant_id: headers.tenant_id,
            },
          },
        );
        for (const currentAppointmentArr of totalAppointments) {
          // found store details
          if (foundStore) {
            const storeDetails = await this.getStoreDetailAPI(
              currentAppointmentArr[0].store_id,
              {
                domain_name: headers['domain_name'],
                tenant_id: headers['tenant_id'],
              },
              null,
            );
            if (storeDetails) {
              storeData = storeDetails['store_details'];
              foundStore = false;
            }
          }
          response['store_details'] = storeData;

          // create appointMent Object first
          const appointment_uniq_id = this.generateAppointmentUniqId(
            storeData?.store_name,
          );

          response.appointments.push({
            time_from: currentAppointmentArr[0].time_from,
            time_to:
              currentAppointmentArr[currentAppointmentArr.length - 1].time_to,
            appointment_uniq_id,
          });
          // create appointment obj
          const booked_from =
            confirmAppointmentDto.booked_from || headers['device_type'];
          const appointmentObj = {
            requested_from: headers.device_type,
            appointment_uniq_id,
            tenant_id: headers.tenant_id,
            client_id: headers.customer_id || null,
            discount: currentAppointmentArr[0].discount || 0,
            appointment_time: new Date(currentAppointmentArr[0].time_from),
            appointment_end_time: new Date(
              currentAppointmentArr[currentAppointmentArr.length - 1].time_to,
            ),
            total_tax: 0,
            status: 'booked',
            created_by: headers.customer_id || headers.guest_user_id,
            guest_user_id: headers.guest_user_id || null,
            store_timezone: storeData?.timezone || 'GMT',
            cancellation_charge: customerConfigObj
              ? customerConfigObj.value['cancellation_percent']
              : null,
            booked_from: booked_from || null,
          };

          const total_price = currentAppointmentArr.reduce((acc, obj) => {
            const service_option_price =
              parseFloat(obj.service_option_price) || 0;

            if (parseFloat(obj.discounted_price)) {
              return (
                acc + parseFloat(obj.discounted_price) + service_option_price
              );
            } else {
              return acc + parseFloat(obj.price) + service_option_price;
            }
          }, 0);

          appointmentObj['total_price'] = total_price;

          // discounted price
          const total_discounted_price = currentAppointmentArr.reduce(
            (acc, obj) => {
              let price = acc + parseFloat(obj.discounted_price);
              if (obj.service_option_price) {
                price += parseFloat(obj.service_option_price);
              }
              return price;
            },
            0,
          );

          let cardObj = {};
          if (confirmAppointmentDto.card_id) {
            cardObj = {
              card_id: confirmAppointmentDto.card_id,
            };
            appointmentObj['card_details'] = cardObj;
          }

          if (confirmAppointmentDto.card_number) {
            confirmAppointmentDto.card_number =
              confirmAppointmentDto.card_number.replace(/.(?=.{4})/g, '*');
            cardObj = {
              card_number: confirmAppointmentDto.card_number || null,
              card_type: confirmAppointmentDto.card_type || null,
              card_holder_name: confirmAppointmentDto.card_holder_name || null,
              expiry_date: confirmAppointmentDto.expiry_date || null,
              pg_customer_id: confirmAppointmentDto['pg_customer_id'] || null,
            };
          }

          appointmentObj['payment_mode'] =
            confirmAppointmentDto.payment_mode || 'online';
          appointmentObj['card_details'] = cardObj;

          const savedAppoinment = await this.appointmentRepository.save(
            AppointmentBookDto.toEntity(appointmentObj),
          );

          const service_name = [];
          const guest_name = [];
          const cutter_name = [];
          for (const service of currentAppointmentArr) {
            // Create obj to save appointment service
            const appointmentServiceObj: any = {
              tenant_id: headers.tenant_id,
              cutter_id: service.cutter_id,
              store_id: service.store_id,
              price: +service.price,
              tax: 0,
              discount: service.discount || null,
              exp_start_date: moment(service.time_from).format(
                Constant.DATE_FORMAT.YMD_HMD,
              ),
              exp_end_date: moment(service.time_to).format(
                Constant.DATE_FORMAT.YMD_HMD,
              ),
              created_by: headers.customer_id,
              appointment_id: savedAppoinment.id,
              guest_name: service.guest_name || null,
              guest_user_id: service.guest_id || null,
              package_id: service.package_id || null,
              service_option_id: service.service_option_id || null,
              cutter_note: service.cutter_note || null,
              service_option_name: service.service_option_name || null,
              service_option_price: service.service_option_price || null,
              service_option_duration: service.service_option_duration || null,
              is_cutter_assigned: +service.is_cutter_assigned || 0,
              service_or_package_name: service?.name || '',
              approx_time: service?.approx_time || 0,
            };

            // check values of deviceType in header :: kiosk
            if (
              headers.guest_user_id &&
              (headers.device_type === Constant.DEVICE_TYPE.KIOSK ||
                headers.device_type === Constant.DEVICE_TYPE.PORTAL ||
                headers.api_type === Constant.API_TYPE.WALK_IN)
            ) {
              appointmentServiceObj['guest_user_id'] = headers.guest_user_id;
              appointmentServiceObj['is_existing_user'] =
                headers.is_existing_user === 'true' ? true : false;
            }

            if (service.name) {
              service_name.push(service.name);
            }
            if (service.guest_name) {
              guest_name.push(service.guest_name);
            }
            if (service.cutter_name) {
              cutter_name.push(service.cutter_name);
            }

            if (service.package_id) {
              for (let i = 0; i < service.service_id.length; i++) {
                appointmentServiceObj['service_id'] = service.service_id[i].id;
                appointmentServiceObj['service_price'] =
                  service.service_id[i].price;
                appointmentServiceObj['service_discount'] =
                  service.service_id[i]?.discount || 0;
                appointmentServiceObj['service_discounted_price'] =
                  service.service_id[i]?.discounted_price || 0;
                appointmentServiceObj['service_name'] =
                  service.service_id[i]?.name || '';
                await this.appointmentServiceRepository.save(
                  AppointmentServiceDto.toEntity(appointmentServiceObj),
                );
              }
            } else {
              appointmentServiceObj['service_id'] = service.service_id;
              await this.appointmentServiceRepository.save(
                appointmentServiceObj,
              );
            }

            // update appointment with store's timezone
            if (storeData) {
              await this.appointmentRepository.update(
                {
                  id: savedAppoinment.id,
                },
                {
                  store_timezone: storeData?.timezone,
                },
              );
            }

            if (service.name) {
              service_name.push(service.name);
            }
            if (service.guest_name) {
              guest_name.push(service.guest_name);
            }
            if (service.cutter_name) {
              cutter_name.push(service.cutter_name);
            }
          }

          // emit event in rabbitmq
          if (userData) {
            let message = `You booked ${[...new Set(service_name)].join(
              ', ',
            )} services `;
            if (guest_name.length) {
              message += 'for ' + [...new Set(guest_name)].join(', ') + ' ';
            }
            message +=
              storeData && storeData.name ? 'at ' + storeData.name : '';
            let store_address = null;
            if (storeData) {
              store_address = storeData.address ? storeData.address + ', ' : '';
              store_address += storeData.street_name
                ? storeData.street_name + ', '
                : '';
              store_address += storeData.suite_number
                ? storeData.suite_number + ', '
                : '';
              store_address += storeData.city ? storeData.city + ', ' : '';
              store_address += storeData.state ? storeData.state + ', ' : '';
              store_address += storeData.zipcode ? storeData.zipcode : '';
            }
            const notificationObj = {
              appointment_uniq_id,
              tenant_id: headers.tenant_id,
              category_id: notificationCategory.id,
              user_type: 'customer',
              title: 'Upcoming Appointment',
              message_id: savedAppoinment.id,
              message: message,
              schedule_time: new Date(currentAppointmentArr[0].time_from),
              receiver_id: userData.id,
              expiry_date: new Date(
                currentAppointmentArr[currentAppointmentArr.length - 1].time_to,
              ),
              created_by: headers.customer_id
                ? headers.customer_id
                : headers.guest_user_id,

              appointment_id: savedAppoinment.id,
              service_name: [...new Set(service_name)].join(', '),
              date_time: new Date(currentAppointmentArr[0].time_from),
              time_from: new Date(currentAppointmentArr[0].time_from),
              time_to: new Date(
                currentAppointmentArr[currentAppointmentArr.length - 1].time_to,
              ),
              customer_name: `${
                userData.fullname ? userData.fullname : userData.name
              }`,
              guest_name: [...new Set(guest_name)].join(', '),
              cutter_name: [...new Set(cutter_name)].join(', '),
              service_price: total_discounted_price,
              store_name:
                storeData && storeData.store_name ? storeData.store_name : '',
              store_timezone:
                storeData && storeData.timezone ? storeData.timezone : '',
              store_address: store_address ? store_address : '',
              brand_name:
                franchisorData && franchisorData.brand_name
                  ? franchisorData.brand_name
                  : null,
              brand_domain:
                franchisorData && franchisorData.domain_name
                  ? franchisorData.domain_name
                  : null,
              domain_name: headers['domain_name'],
              store_contact: storeData?.contact ? storeData?.contact : null,
              store_id: storeData?.store_id ? storeData?.store_id : '',
            };
            if (
              userData.email &&
              userData.customer_preference &&
              userData.customer_preference.preference &&
              userData.customer_preference.preference.email_newsletters &&
              userData.phone &&
              userData.customer_preference.preference.text_messages &&
              userData.device_token &&
              userData.customer_preference.preference.push_notifications
            ) {
              notificationObj['to'] = userData.email;
              // notificationObj['mobile_number'] = userData.phone;
              notificationObj['mobile_number'] =
                userData.preferred_phone || userData.phone;
              notificationObj['token'] = userData.device_token;
              const notificaitonType = notificationTypes.find(
                (nt) => nt.type === '111',
              );
              notificationObj['notification_type'] = notificaitonType.id;
            } else if (
              userData.email &&
              userData.customer_preference &&
              userData.customer_preference.preference &&
              userData.customer_preference.preference.email_newsletters &&
              userData.phone &&
              userData.customer_preference.preference.text_messages
            ) {
              notificationObj['to'] = userData.email;
              // notificationObj['mobile_number'] = userData.phone;
              notificationObj['mobile_number'] =
                userData.preferred_phone || userData.phone;
              const notificaitonType = notificationTypes.find(
                (nt) => nt.type === '110',
              );
              notificationObj['notification_type'] = notificaitonType.id;
            } else if (
              userData.email &&
              userData.customer_preference &&
              userData.customer_preference.preference &&
              userData.customer_preference.preference.email_newsletters &&
              userData.device_token &&
              userData.customer_preference.preference.push_notifications
            ) {
              notificationObj['to'] = userData.email;
              notificationObj['token'] = userData.device_token;
              const notificaitonType = notificationTypes.find(
                (nt) => nt.type == '011' || nt.type == '11',
              );
              notificationObj['notification_type'] = notificaitonType.id;
            } else if (
              userData.phone &&
              userData.customer_preference &&
              userData.customer_preference.preference &&
              userData.customer_preference.preference.text_messages &&
              userData.device_token &&
              userData.customer_preference.preference.push_notifications
            ) {
              // notificationObj['mobile_number'] = userData.phone;
              notificationObj['mobile_number'] =
                userData.preferred_phone || userData.phone;
              notificationObj['token'] = userData.device_token;
              const notificaitonType = notificationTypes.find(
                (nt) => nt.type == '101',
              );
              notificationObj['notification_type'] = notificaitonType.id;
            } else if (
              userData.email &&
              userData.customer_preference &&
              userData.customer_preference.preference &&
              userData.customer_preference.preference.email_newsletters
            ) {
              notificationObj['to'] = userData.email;
              const notificaitonType = notificationTypes.find(
                (nt) => nt.type == '010' || nt.type == '10',
              );
              notificationObj['notification_type'] = notificaitonType.id;
            } else if (
              userData.phone &&
              userData.customer_preference &&
              userData.customer_preference.preference &&
              userData.customer_preference.preference.text_messages
            ) {
              // notificationObj['mobile_number'] = userData.phone;
              notificationObj['mobile_number'] =
                userData.preferred_phone || userData.phone;
              const notificaitonType = notificationTypes.find(
                (nt) => nt.type == '100',
              );
              notificationObj['notification_type'] = notificaitonType.id;
            } else if (
              userData.device_token &&
              userData.customer_preference &&
              userData.customer_preference.preference &&
              userData.customer_preference.preference.push_notifications
            ) {
              notificationObj['token'] = userData.device_token;
              const notificaitonType = notificationTypes.find(
                (nt) => nt.type == '1',
              );
              notificationObj['notification_type'] = notificaitonType.id;
            } else if (userData.mobile) {
              // notificationObj['mobile_number'] = userData.mobile;
              notificationObj['mobile_number'] =
                userData.preferred_phone || userData.phone;
              notificationObj['customer_name'] = userData.name;
              const notificaitonType = notificationTypes.find(
                (nt) => nt.type == '100',
              );
              notificationObj['notification_type'] = notificaitonType.id;
            }
            this.logger.info(
              `AppointmentsService : confirmAppointment : notificationObj : ${JSON.stringify(
                notificationObj,
              )}`,
            );
            this.ECSlogger.info(
              `AppointmentsService : confirmAppointment : notificationObj : ${JSON.stringify(
                notificationObj,
              )}`,
            );
            // publish message to rabbitmq
            await this.rabbitMQService.emitMqMessages(
              'create_notification',
              notificationObj,
            );
          }
        }
      }

      // remove key from redis
      this.redisService.del(key);

      // remove guests
      const guestKey = Constant.REDIS.userGuestKey + id;
      await this.redisService.del(guestKey);

      this.logger.info(
        `CustomerJourneyService : Exit confirmAppointment Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit confirmAppointment Method`,
      );
      return response;
    } catch (err) {
      throw err;
    }
  }

  async acceptCancellationPolicy(cancellationPolicyDto: CancellationPolicyDto) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter acceptCancellationPolicy Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter acceptCancellationPolicy Method`,
      );

      // TODO :: add customer id validation in future.
      const objToInsert = {
        customer_id: cancellationPolicyDto.customer_id,
        is_accept: cancellationPolicyDto.is_accept,
        date: moment().format(Constant.DATE_FORMAT.YMD_HMD),
      };

      await this.customerCancellationPolicy.save(objToInsert);

      this.logger.info(
        `CustomerJourneyService : Exit acceptCancellationPolicy Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit acceptCancellationPolicy Method`,
      );
      return true;
    } catch (err) {
      throw err;
    }
  }

  async updateRedisKey(
    updateRedisKeyDto: UpdateRedisKeyDto,
    tenant_id: string,
  ) {
    try {
      this.logger.info(`CustomerJourneyService : Enter updateRedisKey Method`);
      this.ECSlogger.info(
        `CustomerJourneyService : Enter updateRedisKey Method`,
      );

      const [configObj] = await this.franchisorConfigRepository.find({
        where: {
          category: 'appointment_service_config',
          tenant_id: tenant_id,
        },
      });

      let max_service_in_cart =
        configObj && +configObj.value['max_service_in_cart']
          ? +configObj.value['max_service_in_cart']
          : Constant.max_service_in_cart;

      // get total max limit which should be in cart for guest and user
      const totalServiceLimit =
        max_service_in_cart + Constant.max_guest_limit * 3;

      if (updateRedisKeyDto?.cart_uniq_id && updateRedisKeyDto?.customer_id) {
        const existingKey =
          Constant.REDIS.userCartKey + updateRedisKeyDto?.cart_uniq_id;
        const newKey =
          Constant.REDIS.userCartKey + updateRedisKeyDto?.customer_id;

        const existingGuestKey =
          Constant.REDIS.userGuestKey + updateRedisKeyDto?.cart_uniq_id;
        const newGuestKey =
          Constant.REDIS.userGuestKey + updateRedisKeyDto?.customer_id;

        // // TODO :: amp-5291 uncomment below code.
        const newKeyData = (await this.redisService.get(newKey)) || [];
        let existingData = await this.redisService.get(existingKey);

        const existingGuestData = await this.redisService.get(existingGuestKey);

        if (existingData && existingData.length) {
          const ttl = await this.redisService.getTtl(existingKey);

          //add customeid in new redis key
          existingData.forEach((obj) => {
            obj['customer_id'] = updateRedisKeyDto?.customer_id;
            obj['guest_user_id'] = '';
          });
          // set old data in new key
          // TODO :: amp-5291 uncomment below code.
          if (newKeyData?.length) {
            // combine if not a single service has time_form and time_to
            const servicesWithTime = existingData.filter(
              (obj) => !obj.time_from && !obj.time_to,
            );
            const newServicesWithTime = newKeyData.filter(
              (obj) => !obj.time_from && !obj.time_to,
            );

            let combinedCartData = [...existingData];
            if (
              servicesWithTime.length === existingData.length &&
              newServicesWithTime.length === newKeyData.length
            ) {
              combinedCartData = [...existingData, ...newKeyData];
            }

            // condition to check guest services and user services
            const onlyGuestServices = combinedCartData.filter(
              (obj) => obj.guest_id,
            );

            if (onlyGuestServices.length) {
              max_service_in_cart = totalServiceLimit;
            }
            //commended if statement AMP-7154 guest service not removed.Revoked changes
            if (combinedCartData.length <= max_service_in_cart) {
              existingData = combinedCartData;
            } else {
              existingData = [...existingData];
            }
          }
          //Remove ttl AMP-7154 guest service not removed
          await this.redisService.set(newKey, existingData, ttl);
          if (existingGuestData) {
            await this.redisService.set(newGuestKey, existingGuestData, ttl);
            await this.redisService.del(existingGuestKey);
          }
          // delete old key
          await this.redisService.del(existingKey);
        } else {
          throw new Error(Language.ERROR.ERR_CART_NOT_FOUND);
        }
      }

      this.logger.info(`CustomerJourneyService : Exit updateRedisKey Method`);
      this.ECSlogger.info(
        `CustomerJourneyService : Exit updateRedisKey Method`,
      );
      return;
    } catch (err) {
      throw err;
    }
  }

  async clearBookedSlots(cleareSlotsDto: CJClearSlotDto) {
    try {
      this.ECSlogger.info(
        `CustomerJourneyService : Enter clearBookedSlots Method`,
      );
      const key = Constant.REDIS.userCartKey + cleareSlotsDto.cart_uniq_id;

      const cartData = (await this.redisService.get(key)) || [];
      if (cartData) {
        if (+cleareSlotsDto?.is_different_store) {
          // remove previous services
          await this.redisService.del(key);
          return;
        }

        // clear time_from, time_to, cutter_id, cutter_name, cutter_profile_image
        cartData.forEach((obj) => {
          obj.time_from = '';
          obj.time_to = '';
          obj.cutter_id = '';
          obj.cutter_name = '';
          obj.cutter_profile_image = '';
        });

        const ttlTime = await this.redisService.getTtl(key);

        // const timeFromCount = cartData.filter((item) => !item.time_from);
        // if (timeFromCount?.length === cartData?.length) {
        //   await this.redisService.set(key, cartData);
        // } else {
        //   if (ttlTime <= 0) {
        //     await this.redisService.set(
        //       key,
        //       cartData,
        //       Constant.REDIS.TTL,
        //     );
        //   }else{
        //     await this.redisService.set(key, cartData, ttlTime);
        //   }
        // }
        this.ECSlogger.info(
          `CustomerJourneyService : Exit clearBookedSlots Method`,
        );
        await this.redisService.set(key, cartData, ttlTime);
        return true;
      } else {
        throw new Error(Language.ERROR.ERR_CART_NOT_FOUND);
      }
    } catch (err) {
      throw err;
    }
  }

  async addGuest(addGuestDto: CJAddGuestDto, headers: any) {
    try {
      this.logger.info(`CustomerJourneyService : Enter addGuest Method`);
      this.ECSlogger.info(`CustomerJourneyService : Enter addGuest Method`);

      const id = headers.customer_id || headers.guest_user_id;

      const redisGuestKey = Constant.REDIS.userGuestKey + id;
      const userCartKey = Constant.REDIS.userCartKey + id;
      // check existing guest data
      const existingData = await this.redisService.get(redisGuestKey);
      let cartData = await this.redisService.get(userCartKey);

      if (existingData?.length) {
        // find already guest_id is there or not
        const addedGuestIndex = existingData.findIndex(
          (obj) => obj.guest_id === addGuestDto.guest_id,
        );

        if (addedGuestIndex !== -1 && addGuestDto.is_add) {
          // update name
          existingData[addedGuestIndex].guest_name = addGuestDto.guest_name;
        }

        if (addedGuestIndex === -1 && addGuestDto.is_add) {
          if (existingData.length < Constant.max_guest_limit) {
            // add new guest
            existingData.push({
              guest_id: addGuestDto.guest_id,
              guest_name: addGuestDto.guest_name,
            });
          } else {
            throw new Error(Language.ERROR.ERR_GUEST_ADD);
          }
        }

        if (addedGuestIndex !== -1 && addGuestDto.is_add === 0) {
          // remove existing guest
          existingData.splice(addedGuestIndex, 1);

          // remove service from cart if guest is removed
          if (cartData && cartData.length) {
            cartData = cartData.filter(
              (obj) => !obj.guest_id || obj.guest_id !== addGuestDto.guest_id,
            );
            await this.redisService.set(userCartKey, cartData);
          }
        }

        if (existingData.length === 0) {
          await this.redisService.del(redisGuestKey);
        } else {
          await this.redisService.set(redisGuestKey, existingData);
        }
      } else {
        if (addGuestDto.is_add) {
          const obj = [
            {
              guest_id: addGuestDto.guest_id,
              guest_name: addGuestDto.guest_name,
            },
          ];
          await this.redisService.set(redisGuestKey, obj);
        }
      }

      this.logger.info(`CustomerJourneyService : Exit addGuest Method`);
      this.ECSlogger.info(`CustomerJourneyService : Exit addGuest Method`);

      return true;
    } catch (err) {
      throw err;
    }
  }

  async manageCartAppointmentRebook(
    appointmentEditDto: CJAppointmentEditDto,
    rebookStatus: any,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter manageCartAppointmentRebook Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter manageCartAppointmentRebook Method`,
      );
      const appointment = await this.appointmentRepository.findOne({
        relations: ['service_booked'],
        where: {
          id: appointmentEditDto.appointment_id,
        },
      });
      if (appointment) {
        if (rebookStatus && parseInt(rebookStatus) === 1) {
          const appointmentResult =
            this.getServiceDetailsForRebookAdmin(appointment);
          return appointmentResult;
        }

        const id = appointmentEditDto.customer_id;
        const key = Constant.REDIS.userCartKey + id;
        // remove key from redis
        this.redisService.del(key);

        const ttlTime = await this.appointmentService.getTTLTime(
          appointment.tenant_id,
        );
        const addToCart = [];
        // Add expire time with configurable time limit
        const current_time = new Date().getTime();
        const new_time =
          current_time + Constant.REDIS.expireMinutes * 60 * 1000;
        const expire_time = new Date(new_time);

        const configObj = await this.franchisorConfigRepository.find({
          where: {
            category: In(['appointment_service_config', 'customer_config']),
            tenant_id: appointment.tenant_id,
          },
        });

        const appointmentServiceConfig = configObj.find(
          (c) => c.category === 'appointment_service_config',
        );
        const cart_timer_limit = appointmentServiceConfig
          ? +appointmentServiceConfig.value['cart_timer_mins']
          : Constant.REDIS.TTL_IN_MIN;
        const endDate = moment()
          .add(+cart_timer_limit, 'minutes')
          .format(Constant.DATE_FORMAT.YMD_THMD);

        for (const service_booked of appointment.service_booked) {
          const serviceData = await this.serviceViewRepository.findOne({
            service_id: service_booked.service_id,
            status: 'active',
          });

          // Note: get cutter details.
          const cutterData = await this.cutterScheduleRepository.findOne({
            employee_user_id: service_booked.cutter_id,
          });

          // Note: get store details.
          const storeData = await this.storeDetailRepository.findOne({
            id: service_booked.store_id,
          });

          const addToCartObj = {
            customer_id: appointment.client_id,
            customer_name:
              appointment.customer_details &&
              appointment.customer_details.fullname
                ? appointment.customer_details.fullname
                : '',
            guest_name: service_booked.guest_name
              ? service_booked.guest_name
              : '',
            guest_id: service_booked.guest_user_id
              ? service_booked.guest_user_id
              : '',
            store_id: service_booked.store_id,
            store_name: storeData ? storeData.name : '',
            time_from: this.removeTimeZone(service_booked.exp_start_date),
            time_to: this.removeTimeZone(service_booked.exp_end_date),
            name: serviceData.service_name ? serviceData.service_name : '',
            price: serviceData.price,
            approx_time: this.utilityService.convertH2M(
              serviceData.approx_time,
            ),
            discount: serviceData.discount,
            discounted_price:
              serviceData.discount && +serviceData.discount
                ? +(
                    serviceData.price -
                    (serviceData.price * +serviceData.discount) / 100
                  ).toFixed(2)
                : serviceData.price,
            service_option_id: serviceData.svc_option_id
              ? serviceData.svc_option_id
              : '',
            service_option_duration: serviceData.svc_option_duration
              ? this.utilityService.convertH2M(serviceData.svc_option_duration)
              : serviceData.svc_option_duration,
            service_option_price: serviceData.optional_service_price,
            expire_time: expire_time,
            selectedAddOns: '',
            is_quick_book_flow: true,
            tenant_id: appointment.tenant_id,
            guest_user_id: appointment.guest_user_id
              ? appointment.guest_user_id
              : '',
            endDate: endDate,
            rebook_cutter_id: service_booked.cutter_id,
            rebook_cutter_status: cutterData ? cutterData.status : '',
          };
          const service_options = [];
          if (serviceData.svc_option_id) {
            service_options.push({
              duration: serviceData.svc_option_duration
                ? this.utilityService.convertH2M(
                    serviceData.svc_option_duration,
                  )
                : serviceData.svc_option_duration,
              id: serviceData.svc_option_id,
              name: serviceData.svc_option_name,
              price: serviceData.optional_service_price,
            });
          }
          addToCartObj['service_options'] = service_options;

          if (service_booked.cutter_note !== null) {
            addToCartObj['cutter_note'] = service_booked.cutter_note;
          }

          if (service_booked.package_id) {
            const service_id_arr = [];
            for (const booked of appointment.service_booked) {
              service_id_arr.push({
                id: booked.id,
                name: booked.service_name,
                price: booked.service_price,
                discounted_price: booked.service_discounted_price,
              });
            }
            addToCartObj['service_id'] = service_id_arr;
            addToCartObj['package_id'] = service_booked.package_id;
            addToCartObj['package_name'] =
              service_booked.service_or_package_name;
          } else {
            addToCartObj['service_id'] = service_booked.service_id;
            addToCartObj['package_id'] = '';
            addToCartObj['package_name'] = '';
          }

          const foundCart = addToCart.find(
            (c) => c.package_id === service_booked.package_id,
          );
          if (!foundCart) {
            addToCart.push(addToCartObj);
          }
        }
        if (addToCart) {
          await this.redisService.set(key, addToCart, ttlTime);
        }
      } else {
        throw new NotFoundException(
          `Appointment #${appointmentEditDto.appointment_id} not found.`,
        );
      }
      this.logger.info(
        `CustomerJourneyService : Exit manageCartAppointmentRebook Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit manageCartAppointmentRebook Method`,
      );
      return appointment;
    } catch (err) {
      throw err;
    }
  }

  async appointmentEmployeeStoreList(employee_id: string) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter appointmentEmployeeStoreList Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter appointmentEmployeeStoreList Method`,
      );
      const stores = await this.storeDetailRepository.query(
        `SELECT DISTINCT(id), name, status, timezone FROM public.mv_stores WHERE status = 2 AND id IN (SELECT DISTINCT(store_id) FROM public.mv_cutter_schedule WHERE employee_user_id = '${employee_id}')`,
      );
      this.logger.info(
        `CustomerJourneyService : Exit appointmentEmployeeStoreList Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit appointmentEmployeeStoreList Method`,
      );
      return stores;
    } catch (err) {
      throw err;
    }
  }

  async getAppoinmentEmployeeStoreWise(employee_id: string, date: string) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter appointmentEmployeeStoreList Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter appointmentEmployeeStoreList Method`,
      );
      let storeDetails = [];
      const employeeStores = await this.cutterScheduleRepository.find({
        where: {
          employee_user_id: employee_id,
          shift_start_time: MoreThanOrEqual(
            this.utilityService.getStartOfTheDay(date),
          ),
          shift_end_time: LessThan(this.utilityService.getEndOfTheDay(date)),
        },
      });
      if (employeeStores && employeeStores.length > 0) {
        const uniqueEmployeeStores = [
          ...new Set(
            employeeStores.map((employeeStore) => employeeStore.store_id),
          ),
        ];
        const currentDay = new Date(date).getDay();
        const dayName = Constant.WEEK_DAYS[currentDay];
        storeDetails = await this.storeDetailRepository.query(
          `SELECT id, name, store_open_time, store_end_time, store_image, timezone FROM public.mv_stores WHERE id IN ('${uniqueEmployeeStores}') AND weekday = '${dayName}' AND is_deleted=false`,
        );
        if (storeDetails) {
          const color_codes = [
            '#FFCCCC',
            '#FFE5CC',
            '#E5FFCC',
            '#CCFFCC',
            '#E0E0E0',
            '#CCFFE5',
            '#CCE5FF',
            '#CCE5FF',
            '#FF66B2',
            '#FF9999',
          ];
          storeDetails = [
            ...new Map(
              storeDetails.map((storeDetail) => [
                storeDetail['id'],
                storeDetail,
              ]),
            ).values(),
          ];
          for (const storeDetail of storeDetails) {
            storeDetail['appointments'] = [];
            storeDetail['store_open_formatted_time'] = this.removeTimeZone(
              moment(
                date + ' ' + storeDetail.store_open_time,
                'YYYY/MM/DD hh:mm A',
              ),
            );
            storeDetail['store_end_formatted_time'] = this.removeTimeZone(
              moment(
                date + ' ' + storeDetail.store_end_time,
                'YYYY/MM/DD hh:mm A',
              ),
            );

            const customerAppointments = await this.appointmentRepository.find({
              relations: ['service_booked'],
              where: (qb) => {
                qb.where('Appointment__service_booked.store_id = :store_id', {
                  store_id: storeDetail.id,
                })
                  .andWhere(
                    'Appointment__service_booked.cutter_id = :employee_id',
                    {
                      employee_id: employee_id,
                    },
                  )
                  .andWhere(
                    `"Appointment"."appointment_time" BETWEEN :begin AND :end`,
                    {
                      begin: this.utilityService.getStartOfTheDay(date),
                      end: this.utilityService.getEndOfTheDay(date),
                    },
                  );
              },
              order: {
                appointment_time: 'ASC',
              },
            });
            if (customerAppointments) {
              for (const customerAppointment of customerAppointments) {
                for (const customerAppointmentService of customerAppointment.service_booked) {
                  storeDetail.appointments.push({
                    time_from: this.removeTimeZone(
                      customerAppointmentService.exp_start_date,
                    ),
                    time_to: this.removeTimeZone(
                      customerAppointmentService.exp_end_date,
                    ),
                    type: customerAppointment.status,
                    service_or_package_name:
                      customerAppointmentService.service_or_package_name,
                    color_code:
                      color_codes[
                        Math.floor(Math.random() * color_codes.length)
                      ],
                  });
                }
              }
            }

            const employeeStore = employeeStores.filter(
              (es) => es.store_id === storeDetail.id,
            );

            employeeStore.sort(function (x, y) {
              if (new Date(x.shift_start_time) > new Date(y.shift_start_time)) {
                return 1;
              }
              if (new Date(x.shift_start_time) < new Date(y.shift_start_time)) {
                return -1;
              }
              return 0;
            });

            storeDetail['employee_shift_start_time'] = moment(
              employeeStore[0].shift_start_time,
            ).format('hh:mm A');
            storeDetail['employee_shift_end_time'] = moment(
              employeeStore[employeeStore.length - 1].shift_end_time,
            ).format('hh:mm A');

            storeDetail['employee_shift_start_formattted_time'] =
              this.removeTimeZone(employeeStore[0].shift_start_time);
            storeDetail['employee_shift_end_formattted_time'] =
              this.removeTimeZone(
                employeeStore[employeeStore.length - 1].shift_end_time,
              );

            const employeeAppointments = employeeStores.filter(
              (es) =>
                es.shift_type !== 'shift' && es.store_id === storeDetail.id,
            );
            if (employeeAppointments) {
              for (const employeeAppointment of employeeAppointments) {
                storeDetail.appointments.push({
                  time_from: this.removeTimeZone(
                    employeeAppointment.shift_start_time,
                  ),
                  time_to: this.removeTimeZone(
                    employeeAppointment.shift_end_time,
                  ),
                  type: employeeAppointment.shift_type,
                  service_or_package_name:
                    employeeAppointment.shift_type.replace('_', ' '),
                  color_code: '#A0A0A0',
                });
              }
            }
            if (storeDetail.appointments) {
              storeDetail.appointments.sort(function (x, y) {
                if (new Date(x.time_from) > new Date(y.time_from)) {
                  return 1;
                }
                if (new Date(x.time_from) < new Date(y.time_from)) {
                  return -1;
                }
                return 0;
              });
            }
          }
        }
      }
      this.logger.info(
        `CustomerJourneyService : Exit appointmentEmployeeStoreList Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit appointmentEmployeeStoreList Method`,
      );
      return storeDetails;
    } catch (err) {
      throw err;
    }
  }
  // PRIVATE METHODS

  private async getStoreDetails(
    store_id: string,
    date: string = null,
    tenant_id,
  ) {
    try {
      this.logger.info(`CustomerJourneyService : Enter getStoreDetails Method`);
      this.ECSlogger.info(
        `CustomerJourneyService : Enter getStoreDetails Method`,
      );

      let where = `id = '${store_id}'`;

      if (date) {
        const currentDay = new Date(date).getDay();
        const dayName = Constant.WEEK_DAYS[currentDay];
        where += ` AND weekday = '${dayName}'`;
      }

      const query = `
        SELECT * FROM public.mv_stores where ${where}
      `;

      let [storeData] = await this.storeDetailRepository.query(query);

      if (!storeData) {
        throw new Error(Language.ERROR.ERR_STORE_NOT_FOUND);
      }

      // if (!storeData?.store_open_time && !storeData.store_close_time) {
      //   throw new Error(Language.ERROR.ERR_STORE_CLOSED);
      // }

      // calculate current time and date of store
      const storeTimezone = storeData?.timezone.toUpperCase() || 'GMT';
      const tzOffset = Constant.timezones[storeTimezone];
      const storeCurrentDate = moment()
        .tz(tzOffset)
        .format('YYYY-MM-DDTHH:mm:ss');

      // const configObj = await this.appointmentService.getFranchisorConfig(
      //   domain_name,
      // );
      // Get presigned_url of store images/logo
      const store_image = await this.getImage(storeData?.logo, tenant_id);
      storeData = {
        ...storeData,
        storeCurrentDate,
        s3_logo_url: storeData.store_imagee,
        store_image,
      };

      this.logger.info(`CustomerJourneyService : Exit getStoreDetails Method`);
      this.ECSlogger.info(
        `CustomerJourneyService : Exit getStoreDetails Method`,
      );

      return storeData;
    } catch (err) {
      throw err;
    }
  }

  private async calculateDateDifference(
    store_open_time,
    store_end_time,
    current_time,
    timezone,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter calculateDateDifference Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter calculateDateDifference Method`,
      );

      let start_time = store_open_time;
      let end_time = store_end_time;
      const date = current_time;
      start_time = start_time.split(' ');
      const time = start_time[0].split(':');
      let stime = time[0];
      if (start_time[1] == 'PM' && stime < 12) stime = parseInt(stime) + 12;
      start_time = stime + ':' + time[1] + ':00';

      end_time = end_time.split(' ');
      const time1 = end_time[0].split(':');
      let etime = time1[0];
      if (end_time[1] == 'PM' && etime < 12) etime = parseInt(etime) + 12;
      end_time = etime + ':' + time1[1] + ':00';

      const startTime = moment(
        `${date} ${start_time}`,
        'YYYY-MM-DD HH:mm:ss',
      ).format('YYYY-MM-DDTHH:mm:ss');

      const endTime = moment(
        `${date} ${end_time}`,
        'YYYY-MM-DD HH:mm:ss',
      ).format('YYYY-MM-DDTHH:mm:ss');

      const storeCurrentDate = moment()
        .tz(timezone)
        .format('YYYY-MM-DDTHH:mm:ss');

      this.logger.info(
        `CustomerJourneyService : Exit calculateDateDifference Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit calculateDateDifference Method`,
      );
      return { startTime, endTime, storeCurrentDate };
      // if ((moment(storeCurrentDate).isAfter(moment(startTime))) && (moment(storeCurrentDate).isBefore(moment(endTime)))) {
      //   return true;
      // } else {
      //   return false;
      // }
    } catch (err) {
      this.logger.info(
        `CustomerJourneyService : calculateDateDifference => ${err}`,
      );
      throw err;
    }
  }

  private async calculateDateRange(
    store_open_time: string,
    store_end_time: string,
    actualStartDate: string,
    date: string,
    flag: string = null,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter calculateDateRange Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter calculateDateRange Method`,
      );
      let startDate = ``;
      let endDate = ``;

      let storeOpenHour = store_open_time.split(':')[0];
      if (
        store_open_time?.split(' ')[1].toLowerCase() === 'pm' &&
        +storeOpenHour !== 12
      ) {
        storeOpenHour = +storeOpenHour + 12 + '';
      }

      if (
        store_open_time?.split(' ')[1].toLowerCase() === 'am' &&
        +storeOpenHour === 12
      ) {
        storeOpenHour = '00';
      }
      if (+storeOpenHour <= 9) {
        storeOpenHour = '0' + +storeOpenHour;
      }

      let storeOpenMinute = store_open_time?.split(' ')[0].split(':')[1];
      if (+storeOpenMinute < 10) {
        storeOpenMinute = `0${+storeOpenMinute}`;
      }
      const store_open_date = `${date} ${storeOpenHour}:${storeOpenMinute}:00`;

      let storeCloseHour = store_end_time?.split(':')[0];
      if (
        store_end_time?.split(' ')[1].toLowerCase() === 'pm' &&
        +storeCloseHour !== 12
      ) {
        storeCloseHour = +storeCloseHour + 12 + '';
      }

      if (+storeCloseHour <= 9) {
        storeCloseHour = '0' + +storeCloseHour;
      }

      let storeCloseMinute = store_end_time?.split(' ')[0].split(':')[1];
      if (+storeCloseMinute < 10) {
        storeCloseMinute = `0${+storeCloseMinute}`;
      }
      const store_close_date = `${date} ${storeCloseHour}:${storeCloseMinute}:00`;
      endDate = store_close_date;

      if (new Date(actualStartDate) >= new Date(store_open_date)) {
        startDate = actualStartDate;
      } else {
        startDate = store_open_date;
      }

      // AMP-7967
      if (
        flag === 'slots' &&
        moment(startDate).isSame(actualStartDate, 'day')
      ) {
        startDate = actualStartDate;
      }
      this.logger.info(
        `CustomerJourneyService : Exit calculateDateRange Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit calculateDateRange Method`,
      );
      return {
        startDate,
        endDate,
      };
    } catch (err) {
      throw err;
    }
  }

  private async newCheckCutterAvailability(
    type: string,
    store_id: string,
    startDate: string,
    endDate: string,
    duration: number,
    time_gap_between_slots: number,
    tenant_id: string,
    max_slots_caraousel: number = null,
    bookedSlots: any = [],
    cart_uniq_id: string = null,
    guest_user_id: string = null,
    customer_id: string = null,
    bookedSlotsFromDB: any = [],
    is_from_edit: number = null,
    paginationObj: any = [],
    guest_id: string = null,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter newCheckCutterAvailability Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter newCheckCutterAvailability Method`,
      );
      // let pagination;
      // if (paginationObj !== '') {
      //   pagination = `LIMIT ${paginationObj.limit} OFFSET ${
      //     (paginationObj.skip - 1) * paginationObj.limit
      //   }`;
      // }

      const newQuery1 = `with emp_data AS ( SELECT DISTINCT on (employee_user_id, shift_start_time, shift_type)
        primary_contact,
        bio,
        email,
        image,
        speciality,
        employee_user_id,
        employee_user_id as cutter_id,
        shift_type,
        shift_start_time,
        shift_end_time,
        cutter_name
          FROM mv_cutter_schedule mvc
          WHERE
                mvc.store_id = '${store_id}'
                AND (
                  (shift_start_time >= '${startDate}' AND shift_end_time > '${startDate}')
                  OR
                  ('${startDate}' >= shift_start_time AND '${startDate}' <= shift_end_time)
                ) AND mvc.shift_end_time <= '${endDate}' AND mvc.status = 'active' AND mvc.is_deleted = false 
          )
          SELECT d.*,
          json_agg(json_build_object('time_from', slots.slot_start_time, 'time_to', slots.slot_end_time)) AS cutter_availability
          ,GREATEST(d.shift_start_time::timestamp, slots.slot_start_time::timestamp) AS cur_time
          FROM emp_data d
          LEFT JOIN LATERAL (
          SELECT  generate_series(
                    GREATEST(d.shift_start_time::timestamp, date_round('${startDate}', '${Constant.slot_round_off_time} minutes')::timestamp),
                    date_round('${endDate}', '${Constant.slot_round_off_time} minutes')::timestamp,
              '${duration} minutes'::interval + (${time_gap_between_slots} * interval '1 minute')
            ) slot_start_time,
            generate_series(
              GREATEST(d.shift_start_time::timestamp, date_round('${startDate}', '${Constant.slot_round_off_time} minutes')::timestamp) + (${duration} * interval '1 minute'),
              date_round('${endDate}', '${Constant.slot_round_off_time} minutes')::timestamp,
              '${duration} minutes'::interval + (${time_gap_between_slots} * interval '1 minute')
            ) slot_end_time
            
          ) slots
          ON slots.slot_start_time >= d.shift_start_time
                AND slots.slot_start_time <= d.shift_end_time AND slots.slot_end_time <= d.shift_end_time
          GROUP BY slot_start_time, slot_end_time, d.cutter_name, d.cutter_id,
                d.primary_contact,d.email,d.speciality, d.shift_end_time, d.shift_start_time,d.image, d.bio, d.employee_user_id, d.shift_type
          HAVING d.shift_start_time IS NOT NULL AND slots.slot_end_time IS NOT NULL
          ORDER BY slots.slot_start_time, slots.slot_end_time, d.cutter_name ASC
          `;

      const cutters = await this.cutterScheduleRepository.query(newQuery1);

      const cutterObj = {};
      let finalCutters = [];
      const configObj = await this.appointmentService.getFranchisorConfig(
        tenant_id,
      );

      const onlySlotsForCarosel = [];

      const otherShifts = cutters.filter((c) => c.shift_type !== 'shift');

      for (const cutter of cutters) {
        const slotInOtherShift = otherShifts.find(
          (obj) =>
            obj.cur_time.toString() === cutter.cur_time.toString() &&
            obj.employee_user_id === cutter.employee_user_id,
        );

        if (cutterObj[cutter.employee_user_id]) {
          // check rest of the slot
          const currentSlot = cutter.cutter_availability[0];
          let shouldInsert = true;
          for (const bookedSlot of bookedSlots) {
            shouldInsert = this.checkWhetherToInserSlot(
              currentSlot,
              bookedSlot,
              store_id,
              bookedSlot.store_id,
              cutter.employee_user_id,
            );

            // Below condition is to add already selected slots when they call update cart api
            if (
              cart_uniq_id &&
              is_from_edit &&
              (bookedSlot.guest_user_id === guest_user_id ||
                bookedSlot.customer_id === customer_id ||
                bookedSlot.guest_id === guest_id) &&
              bookedSlot.cutter_id === cutter.employee_user_id
            ) {
              // check already slot is inserted or not
              const foundElement = cutterObj[cutter.employee_user_id][
                'cutter_availability'
              ].find((obj) => {
                return (
                  obj.time_from.toString() === bookedSlot.time_from.toString()
                );
              });

              // Check booked slot is from DB or not --- if yes then don't push in the arra
              const slotIsFromRedis = bookedSlots.find((slot) => {
                let userCond = bookedSlot.customer_id === slot.customer_id;

                if (guest_id && bookedSlot.guest_id) {
                  userCond = bookedSlot.guest_id === slot.guest_id;
                }
                return (
                  ((new Date(bookedSlot.time_from) >=
                    new Date(slot.time_from) &&
                    new Date(bookedSlot.time_from) < new Date(slot.time_to)) ||
                    (new Date(bookedSlot.time_from) < new Date(slot.time_to) &&
                      new Date(bookedSlot.time_to) >
                        new Date(slot.time_from))) &&
                  userCond &&
                  bookedSlot.cutter_id === slot.cutter_id &&
                  slot.db_booked_slot === 0
                );
              });

              //  && !slotIsFromRedis
              if (!foundElement && is_from_edit && slotIsFromRedis) {
                const foundIndex = cutterObj[cutter.employee_user_id][
                  'cutter_availability'
                ].findIndex((obj) => {
                  return (
                    (new Date(obj['time_from']) >=
                      new Date(bookedSlot.time_from) &&
                      new Date(obj['time_to']) <=
                        new Date(bookedSlot.time_to)) ||
                    (new Date(obj['time_to']) >
                      new Date(bookedSlot.time_from) &&
                      new Date(obj['time_from']) <
                        new Date(bookedSlot.time_to) &&
                      new Date(obj['time_from']).getDate() -
                        new Date(bookedSlot.time_from).getDate() !==
                        0)
                  );
                });

                // check duration and bookedSlot.approx tiem is same or not
                const totalDuration =
                  this.customerJourneyUtility.getBookedDuration(
                    guest_user_id,
                    customer_id,
                    guest_id,
                    bookedSlots,
                    bookedSlot,
                  );

                const durationCond = duration === totalDuration;
                const customerCond =
                  customer_id && bookedSlot.customer_id === customer_id;
                const guestCond = guest_id && bookedSlot.guest_id === guest_id;
                const guestUserCond =
                  guest_user_id && bookedSlot.guest_user_id === guest_user_id;

                const objToInsert = {
                  time_from: bookedSlot.time_from,
                  time_to: bookedSlot.time_to,
                };

                if (foundIndex !== -1 && durationCond) {
                  cutterObj[cutter.employee_user_id][
                    'cutter_availability'
                  ].splice(foundIndex, 1);

                  // only add is_selected if below condition satisfies
                  if (
                    ((customerCond || guestUserCond) &&
                      !guest_id &&
                      !bookedSlot.guest_id) ||
                    guestCond
                  ) {
                    objToInsert['is_selected'] = true;
                  }

                  cutter['cutter_availability'].push(objToInsert);
                  // cutterObj[cutter.employee_user_id][
                  //   'cutter_availability'
                  // ].push({
                  //   time_from: bookedSlot.time_from,
                  //   time_to: bookedSlot.time_to,
                  //   is_selected: true,
                  // });
                }

                if (
                  new Date(startDate).getDate() -
                    new Date(bookedSlot.time_from).getDate() ===
                    0 &&
                  bookedSlot.db_booked_slot === 0 &&
                  durationCond
                ) {
                  // check multiple slot is with is_select or not
                  // TODO:: check guest condition
                  const slotWithIsselect = cutterObj[cutter.employee_user_id][
                    'cutter_availability'
                  ].findIndex((obj) => obj.is_selected);

                  // only add is_selected if below condition satisfies
                  if (
                    ((customerCond || guestUserCond) &&
                      !guest_id &&
                      !bookedSlot.guest_id) ||
                    guestCond
                  ) {
                    objToInsert['is_selected'] = true;
                  }

                  if (slotWithIsselect > -1) {
                    cutterObj[cutter.employee_user_id]['cutter_availability'][
                      slotWithIsselect
                    ]['time_to'] = bookedSlot.time_to;
                  } else {
                    // cutterObj[cutter.employee_user_id][
                    //   'cutter_availability'
                    // ].push({
                    //   time_from: bookedSlot.time_from,
                    //   time_to: bookedSlot.time_to,
                    //   is_selected: true,
                    // });
                    cutter['cutter_availability'].push(objToInsert);
                  }
                }
              }
            }

            if (!shouldInsert) {
              break;
            }
          }

          // temperory condition until query resolve
          // const foundElement = cutterObj[cutter.employee_user_id]['cutter_availability'].find(obj => {
          //   return new Date(obj.time_from) <= new Date(cutter.cutter_availability[0].time_from) &&
          //       new Date(obj.time_to) >= new Date(cutter.cutter_availability[0].time_from)
          // });

          if (
            shouldInsert &&
            !slotInOtherShift &&
            cutter.shift_type === 'shift'
          ) {
            // add slots into the carousel array
            // check already same time slot is inserted or not.
            const duplicatTime = onlySlotsForCarosel.find(
              (obj) =>
                obj.time_from === cutter?.cutter_availability[0].time_from,
            );
            if (!duplicatTime) {
              onlySlotsForCarosel.push({
                cutter_id: cutter.employee_user_id,
                cutter_name: cutter.cutter_name,
                cutter_image: cutter.image,
                time_from: cutter?.cutter_availability[0].time_from,
                time_to: cutter?.cutter_availability[0].time_to,
              });
            }

            cutterObj[cutter.employee_user_id]['cutter_availability'].push(
              ...cutter.cutter_availability,
            );
          }
        } else {
          // Generate presigned url
          let image = '';
          if (cutter?.image && type === 'slots') {
            image = cutter?.image;
          } else {
            image = configObj['default_cutter_image'] || '';
          }

          cutter['first_start_time'] =
            cutter['cutter_availability'][0].time_from;
          cutter['cutter_image'] = image;

          // TODO :: need to make dynamic below values
          cutter['rating'] = +(Math.random() * 5).toFixed(2);
          cutter['total_number_of_rating'] = 50;

          // check first slot
          const currentSlot = cutter.cutter_availability[0];
          let shouldInsert = true;
          for (const bookedSlot of bookedSlots) {
            shouldInsert = this.checkWhetherToInserSlot(
              currentSlot,
              bookedSlot,
              store_id,
              bookedSlot.store_id,
              cutter.employee_user_id,
            );

            // Below condition is to add already selected slots when they call update cart api
            if (
              cart_uniq_id &&
              is_from_edit &&
              (bookedSlot.guest_user_id === guest_user_id ||
                bookedSlot.customer_id === customer_id ||
                bookedSlot.guest_id === guest_id) &&
              bookedSlot.cutter_id === cutter.employee_user_id
            ) {
              // check already slot is inserted or not
              const foundElement = cutter['cutter_availability'].find((obj) => {
                return (
                  obj.time_from.toString() === bookedSlot.time_from.toString()
                );
              });

              // Check booked slot is from DB or not --- if yes then don't push in the array
              const slotIsFromRedis = bookedSlots.find((slot) => {
                let userCond = bookedSlot.customer_id === slot.customer_id;

                if (guest_id && bookedSlot.guest_id) {
                  userCond = bookedSlot.guest_id === slot.guest_id;
                }
                return (
                  ((new Date(bookedSlot.time_from) >=
                    new Date(slot.time_from) &&
                    new Date(bookedSlot.time_from) < new Date(slot.time_to)) ||
                    (new Date(bookedSlot.time_from) < new Date(slot.time_to) &&
                      new Date(bookedSlot.time_to) >
                        new Date(slot.time_from))) &&
                  userCond &&
                  bookedSlot.cutter_id === slot.cutter_id &&
                  slot.db_booked_slot === 0
                );
              });

              const customerCond =
                customer_id && bookedSlot.customer_id === customer_id;
              const guestCond = guest_id && bookedSlot.guest_id === guest_id;

              const guestUserCond =
                guest_user_id && bookedSlot.guest_user_id === guest_user_id;

              // check duration and total bookedSlot.approx_time is same or not for customer and guest.
              const totalDuration =
                this.customerJourneyUtility.getBookedDuration(
                  guest_user_id,
                  customer_id,
                  guest_id,
                  bookedSlots,
                  bookedSlot,
                );

              const durationCond = duration === totalDuration;

              if (
                slotIsFromRedis &&
                is_from_edit &&
                bookedSlot.db_booked_slot === 0
              ) {
                if (!foundElement) {
                  // find index of overlapping slots
                  const foundIndex = cutter['cutter_availability'].findIndex(
                    (obj) => {
                      return (
                        (new Date(obj['time_from']) >=
                          new Date(bookedSlot.time_from) &&
                          new Date(obj['time_to']) <=
                            new Date(bookedSlot.time_to)) ||
                        (new Date(obj['time_to']) >
                          new Date(bookedSlot.time_from) &&
                          new Date(obj['time_from']) <
                            new Date(bookedSlot.time_to) &&
                          new Date(obj['time_from']).getDate() -
                            new Date(bookedSlot.time_from).getDate() !==
                            0)
                      );
                    },
                  );

                  const objToInsert = {
                    time_from: bookedSlot.time_from,
                    time_to: bookedSlot.time_to,
                  };

                  if (foundIndex !== -1 && durationCond) {
                    cutter['cutter_availability'].splice(foundIndex, 1);

                    // only add is_selected if below condition satisfies
                    if (
                      ((customerCond || guestUserCond) &&
                        !guest_id &&
                        !bookedSlot.guest_id) ||
                      guestCond
                    ) {
                      objToInsert['is_selected'] = true;
                    }

                    cutter['cutter_availability'].push(objToInsert);
                    // cutter['cutter_availability'].push({
                    //   time_from: bookedSlot.time_from,
                    //   time_to: bookedSlot.time_to,
                    //   is_selected: true,
                    // });
                    cutterObj[cutter.employee_user_id] = cutter;
                  }

                  if (
                    new Date(startDate).getDate() -
                      new Date(bookedSlot.time_from).getDate() ===
                      0 &&
                    durationCond
                  ) {
                    // check multiple slot is with is_select or not
                    // TODO:: check guest condition
                    const slotWithIsselect = cutter[
                      'cutter_availability'
                    ].findIndex((obj) => obj.is_selected);

                    // only add is_selected if below condition satisfies
                    if (
                      ((customerCond || guestUserCond) &&
                        !guest_id &&
                        !bookedSlot.guest_id) ||
                      guestCond ||
                      (guestUserCond && !guest_id && !bookedSlot.guest_id)
                    ) {
                      objToInsert['is_selected'] = true;
                    }

                    if (
                      slotWithIsselect > -1 &&
                      (((customerCond || guestUserCond) &&
                        !guest_id &&
                        !bookedSlot.guest_id) ||
                        guestCond ||
                        (guestUserCond && !guest_id && !bookedSlot.guest_id))
                    ) {
                      cutter['cutter_availability'][slotWithIsselect][
                        'time_to'
                      ] = bookedSlot.time_to;
                    } else {
                      // cutter['cutter_availability'].push({
                      //   time_from: bookedSlot.time_from,
                      //   time_to: bookedSlot.time_to,
                      //   is_selected: true,
                      // });
                      cutter['cutter_availability'].push(objToInsert);
                    }
                  }
                } else {
                  if (durationCond) {
                    cutterObj[cutter.employee_user_id] = cutter;

                    if (
                      ((customerCond || guestUserCond) &&
                        !guest_id &&
                        !bookedSlot.guest_id) ||
                      guestCond ||
                      (guestUserCond && !guest_id && !bookedSlot.guest_id)
                    ) {
                      cutter['cutter_availability'][0]['is_selected'] = true;
                    }
                  }
                }
              }
            }

            if (!shouldInsert) {
              break;
            }
          }

          if (
            shouldInsert &&
            !slotInOtherShift &&
            cutter.shift_type === 'shift'
          ) {
            // insert into carousel slot array
            const duplicatTime = onlySlotsForCarosel.find(
              (obj) =>
                obj.time_from === cutter?.cutter_availability[0].time_from,
            );
            if (!duplicatTime) {
              onlySlotsForCarosel.push({
                cutter_id: cutter.employee_user_id,
                cutter_name: cutter.cutter_name,
                cutter_image: cutter.image,
                time_from: cutter?.cutter_availability[0].time_from,
                time_to: cutter?.cutter_availability[0].time_to,
              });
            }
            cutterObj[cutter.employee_user_id] = cutter;
          }
        }
        if (
          type !== 'slots' &&
          onlySlotsForCarosel.length === +max_slots_caraousel
        ) {
          break;
        }
      }
      finalCutters = Object.values(cutterObj);

      // TODO ::: cehck this latter
      finalCutters = orderBy(
        finalCutters,
        ['first_start_time', 'rating'],
        ['asc', 'desc'],
      );

      // sort based on time_from and time_to
      if (cart_uniq_id) {
        for (const cutter of finalCutters) {
          cutter['cutter_availability'].sort(function (x, y) {
            if (new Date(x?.time_from) > new Date(y?.time_from)) {
              return 1;
            }
            if (new Date(x?.time_from) < new Date(y?.time_from)) {
              return -1;
            }
            return 0;
          });
        }
      }
      if (type !== 'slots') {
        finalCutters = onlySlotsForCarosel;
        // finalCutters = map(
        //   uniq(
        //     map(finalCutters, function (obj) {
        //       return JSON.stringify(obj);
        //     }),
        //   ),
        //   function (obj) {
        //     return JSON.parse(obj);
        //   },
        // );
        finalCutters.splice(+max_slots_caraousel, finalCutters.length);
      }

      // check favourite flag
      if (type === 'slots' && customer_id) {
        const [customerPreference] = await this.customerViewRepository.query(`
          SELECT * FROM mv_customer WHERE customer_id = '${customer_id}'
        `);

        for (const cutterObj of finalCutters) {
          if (customerPreference && customerPreference?.fav_cutters) {
            const cutterIds = customerPreference?.fav_cutters.map(
              (obj) => obj.cutter_id,
            );
            if (
              cutterIds.length &&
              cutterIds.indexOf(cutterObj.employee_user_id) >= 0
            ) {
              cutterObj['is_favorite'] = true;
            } else {
              cutterObj['is_favorite'] = false;
            }
          } else {
            cutterObj['is_favorite'] = false;
          }
        }
      }

      // remove cutters whose cutter_availability is empty array
      if (type === 'slots') {
        finalCutters = finalCutters.filter(
          (obj) => obj.cutter_availability?.length > 0,
        );
      }
      this.logger.info(
        `CustomerJourneyService : Exit newCheckCutterAvailability Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit newCheckCutterAvailability Method`,
      );
      return finalCutters;
    } catch (err) {
      throw err;
    }
  }

  private async getRecommendedCutter(cutters: any, startDate: string) {
    try {
      const tmpObj = [];
      const recommendedCutter = [];
      let currentDiff;
      let valueAssiged = false;
      for (const cutter of cutters) {
        const differenceInSecond =
          new Date(cutter.first_start_time).valueOf() -
          new Date(startDate).valueOf();

        if (!valueAssiged) {
          currentDiff = differenceInSecond;
          valueAssiged = true;
        }

        if (differenceInSecond <= currentDiff) {
          currentDiff = differenceInSecond;
        }

        tmpObj.push({
          cutter_id: cutter.employee_user_id,
          rating: cutter.rating,
          differenceInSecond,
        });
      }

      // filter out objects which has same difference
      const filteredObjs = tmpObj.filter(
        (obj) => obj.differenceInSecond === currentDiff,
      );

      if (filteredObjs.length) {
        if (filteredObjs.length == 1) {
          const foundCutterIndex = cutters.findIndex(
            (c) => c.employee_user_id === filteredObjs[0].cutter_id,
          );
          if (foundCutterIndex !== -1) {
            recommendedCutter.push({ ...cutters[foundCutterIndex] });
            recommendedCutter[0]['cutter_availability'] =
              cutters[foundCutterIndex]['cutter_availability'];

            // Remove first slot from original obj
            cutters.splice(foundCutterIndex, 1);
            // if (cutters[foundCutterIndex].length === 0) {
            //   cutters.splice(cutters[foundCutterIndex], 1);
            // }
          }
        } else {
          filteredObjs.sort((a, b) => b.rating - a.rating);
          const foundCutterIndex = cutters.findIndex(
            (c) => c.employee_user_id === filteredObjs[0].cutter_id,
          );
          if (foundCutterIndex !== -1) {
            recommendedCutter.push({ ...cutters[foundCutterIndex] });
            recommendedCutter[0]['cutter_availability'] =
              cutters[foundCutterIndex]['cutter_availability'];

            // Remove first slot from original obj
            cutters.splice(foundCutterIndex, 1);
            // if (cutters[foundCutterIndex] === 0) {
            //   cutters.splice(cutters[foundCutterIndex], 1);
            // }
          }
        }
      }

      return recommendedCutter;
    } catch (err) {
      this.logger.info(
        `CustomerJourneyService : ERROR getRecommendedCutter Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : ERROR getRecommendedCutter Method`,
      );
      throw err;
    }
  }

  private async calculateStoreDetailsForCaraousel(
    store_id: string,
    configObj: any,
    tenant_id: string,
    timezone: string,
  ) {
    try {
      const tzOffset = Constant.timezones[timezone];
      const date = moment().tz(tzOffset).format(Constant.DATE_FORMAT.YMD);
      //const date = moment().format(Constant.DATE_FORMAT.YMD);
      const storeDetails = await this.getStoreDetails(
        store_id,
        date,
        tenant_id,
      );

      // this is the flag to add buffer time before calculating the first slot.
      const sleeping_time = configObj?.value
        ? +configObj.value['sleeping_time']
        : +Constant.sleeping_time;

      // this is the flag to add difference between two slots.
      const time_gap_between_slots = configObj?.value
        ? +configObj.value['time_gap_between_slots']
        : +Constant.time_gap_between_slots;

      const max_slots_caraousel = configObj?.value
        ? +configObj.value['max_slots_caraousel']
        : +Constant.max_slots_caraousel;

      // step2: define start date and end date for slots
      const actualStartDate = moment(storeDetails.storeCurrentDate)
        .add(sleeping_time, 'minutes')
        .format(Constant.DATE_FORMAT.YMD_HMD_START_SECOND);

      let startDate = null;
      let endDate = null;
      if (storeDetails.store_open_time && storeDetails.store_end_time) {
        const storeData = await this.calculateDateRange(
          storeDetails.store_open_time,
          storeDetails.store_end_time,
          actualStartDate,
          date,
        );

        startDate = storeData.startDate;
        endDate = storeData.endDate;
      }

      // Step 3: fetch the cutters shift details based on startDate and end Date
      // const cutters = await this.checkCutterAvailability(
      //   store_id,
      //   startDate,
      //   endDate,
      // );

      return {
        startDate,
        endDate,
        time_gap_between_slots,
        max_slots_caraousel,
        sleeping_time,
      };
    } catch (err) {
      this.logger.info(
        `CustomerJourneyService : ERROR calculateStoreDetails Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : ERROR calculateStoreDetails Method`,
      );
      throw err;
    }
  }

  private async getRedisCartDetails() {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter getRedisCartDetails Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter getRedisCartDetails Method`,
      );

      const key = Constant.REDIS.userCartKey + '*';

      const bookedSlots = [];
      const allKeys = await this.redisService.keys(key);

      let mainBookedSlotsArr = [];
      if (allKeys && allKeys.length) {
        const combinedCartData = await this.redisService.mget(allKeys);
        mainBookedSlotsArr = [].concat(...combinedCartData);

        for (const obj of mainBookedSlotsArr) {
          if (obj.time_to && obj.time_from) {
            const objToPush = {
              time_from: obj.time_from,
              time_to: obj.time_to,
              store_id: obj.store_id,
              cutter_id: obj.cutter_id || '',
              service_id: obj.service_id || '',
              customer_id: obj.customer_id || '',
              guest_user_id: obj.guest_user_id || '',
              db_booked_slot: 0,
              guest_id: obj.guest_id || '',
              guest_name: obj.guest_name || '',
              approx_time: obj.approx_time || 0,
              service_option_duration: obj.service_option_duration || 0,
              appointment_id: obj.appointment_id || '',
              appointment_service_id: obj.appointment_service_id || '',
            };
            bookedSlots.push(objToPush);
          }
        }
        // bookedSlots = mainBookedSlotsArr.map((obj) => {
        //   return {
        //     time_from: obj.time_from,
        //     time_to: obj.time_to,
        //     store_id: obj.store_id,
        //     cutter_id: obj.cutter_id || '',
        //     service_id: obj.service_id || '',
        //     customer_id: obj.customer_id || '',
        //     guest_user_id: obj.guest_user_id || '',
        //     db_booked_slot: 0,
        //     guest_id: obj.guest_id || '',
        //     guest_name: obj.guest_name || '',
        //     approx_time: obj.approx_time || 0,
        //     service_option_duration: obj.service_option_duration || 0,
        //   };
        // });
      }

      this.logger.info(
        `CustomerJourneyService : Exit getRedisCartDetails Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit getRedisCartDetails Method`,
      );

      return bookedSlots;
    } catch (err) {
      throw err;
    }
  }

  private checkWhetherToInserSlot(
    currentSlot,
    bookedSlot,
    currentStoreId,
    bookedSlotStoreId,
    cutterId = null,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter checkWhetherToInserSlot Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter checkWhetherToInserSlot Method`,
      );
      let shouldInsert = true;
      const storeCond = currentStoreId === bookedSlotStoreId;
      const cuuterCond = cutterId ? cutterId === bookedSlot.cutter_id : true;
      if (
        (new Date(currentSlot['time_from']) >= new Date(bookedSlot.time_from) &&
          new Date(currentSlot['time_to']) <= new Date(bookedSlot.time_to) &&
          storeCond &&
          cuuterCond) ||
        (new Date(currentSlot['time_to']) > new Date(bookedSlot.time_from) &&
          new Date(currentSlot['time_from']) < new Date(bookedSlot.time_to) &&
          storeCond &&
          cuuterCond)
      ) {
        shouldInsert = false;
      }

      this.logger.info(
        `CustomerJourneyService : Exit checkWhetherToInserSlot Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit checkWhetherToInserSlot Method`,
      );
      return shouldInsert;
    } catch (err) {
      throw err;
    }
  }

  async getEstimatedTime(lat1, long1, lat2, long2) {
    const response = await got(
      `${process.env.API_URL}?origins=${lat1},${long1}&destinations=${lat2},${long2}&key=${process.env.DISTANCE_MATRIX_KEY}`,
    ).json();
    if (response) {
      if (response['rows'][0]) {
        if (
          response['rows'][0]['elements'] &&
          response['rows'][0]['elements'].length > 0
        ) {
          if (response['rows'][0].elements[0]) {
            if (response['rows'][0].elements[0].status === 'ZERO_RESULTS') {
              return {};
            }
            if (response['rows'][0].elements[0].status === 'NOT_FOUND') {
              return {};
            }

            const regHour1 = / hour/g;
            const regHour2 = / hours/g;
            const regMinute1 = / minute/g;
            const regMinute2 = / minutes/g;
            const regMinute3 = / min/g;
            const regMinute4 = / mins/g;

            let minutes =
              response['rows'][0]['elements'][0]['duration']['text'];

            if (minutes) {
              minutes = minutes.replace(regHour2, 'h');
              minutes = minutes.replace(regHour1, 'h');
              minutes = minutes.replace(regMinute2, 'm');
              minutes = minutes.replace(regMinute1, 'm');
              minutes = minutes.replace(regMinute4, 'm');
              minutes = minutes.replace(regMinute3, 'm');
            }
            return {
              durationInMins: minutes,
              durationInSecs:
                response['rows'][0]['elements'][0]['duration']['value'],
            };
          }
        }
      }
    }
  }

  async getCancellationPolicy(domain_name: string, tenant_id: string) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter getCancellationPolicy Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter getCancellationPolicy Method`,
      );

      const secretValue = await this.utilityService.upAWSSecrets(domain_name);

      const [configObj] = await this.brandViewRepository.find({
        tenant_id: tenant_id,
        category: 'default_images_config',
      });

      let key = '';
      if (configObj && configObj.value['cancellation_policy']) {
        key += configObj.value['cancellation_policy'];
      } else {
        key += `${process.env.MODE.toLocaleLowerCase()}/documents/policy/cancelation_policy.pdf`;
      }

      const url = await this.utilityService.generatePresignedUrl(
        secretValue[
          `${process.env.MODE.toLocaleLowerCase()}/AWS_S3_BUCKET_NAME`
        ],
        key,
      );

      this.logger.info(
        `CustomerJourneyService : Exit getCancellationPolicy Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit getCancellationPolicy Method`,
      );
      return url;
    } catch (err) {
      throw err;
    }
  }

  async removeCartDetails(removeCartDto: RemoveCartDto, headers: any) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter removeCartDetails Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter removeCartDetails Method`,
      );
      const key = Constant.REDIS.userCartKey + removeCartDto.cart_uniq_id;
      const getExistingData = await this.redisService.get(key);
      let serviceSlotsIndex;
      let statusMessage;
      const ttl = await this.redisService.getTtl(key);
      if (getExistingData?.length) {
        if (removeCartDto?.is_remove_whole_cart === 1) {
          await this.redisService.del(key);
          return;
        }
        if (
          (headers.customer_id || headers.guest_user_id) &&
          (removeCartDto.services_id || removeCartDto?.package_id)
        ) {
          if (
            headers?.customer_id &&
            removeCartDto.guest_id &&
            (removeCartDto.services_id || removeCartDto?.package_id)
          ) {
            serviceSlotsIndex = getExistingData.findIndex((obj) => {
              if (removeCartDto?.package_id) {
                return (
                  obj?.package_id === removeCartDto?.package_id &&
                  obj?.guest_id === removeCartDto.guest_id &&
                  obj.customer_id === headers?.customer_id
                );
              } else {
                return (
                  obj.service_id === removeCartDto.services_id &&
                  obj?.guest_id === removeCartDto.guest_id &&
                  obj.customer_id === headers?.customer_id
                );
              }
            });
          } else if (
            headers?.customer_id &&
            !removeCartDto.guest_id &&
            (removeCartDto.services_id || removeCartDto?.package_id)
          ) {
            serviceSlotsIndex = getExistingData.findIndex((obj) => {
              if (removeCartDto?.package_id) {
                return (
                  obj?.package_id === removeCartDto?.package_id &&
                  obj.customer_id === headers?.customer_id
                );
              } else {
                return (
                  obj.service_id === removeCartDto.services_id &&
                  obj.customer_id === headers?.customer_id &&
                  !obj.guest_id
                );
              }
            });
          } else if (
            headers?.customer_id &&
            !removeCartDto.guest_id &&
            (!removeCartDto.services_id || !removeCartDto?.package_id)
          ) {
            serviceSlotsIndex = getExistingData.findIndex((obj) => {
              if (removeCartDto?.package_id) {
                return obj.customer_id === headers?.customer_id;
              } else {
                return obj.customer_id === headers?.customer_id;
              }
            });
          } else if (
            headers?.guest_user_id &&
            removeCartDto.guest_id &&
            (removeCartDto.services_id || removeCartDto?.package_id)
          ) {
            serviceSlotsIndex = getExistingData.findIndex((obj) => {
              if (removeCartDto?.package_id) {
                return (
                  obj?.package_id === removeCartDto?.package_id &&
                  obj?.guest_id === removeCartDto.guest_id &&
                  obj.guest_user_id === headers?.guest_user_id
                );
              } else {
                return (
                  obj.service_id === removeCartDto.services_id &&
                  obj?.guest_id === removeCartDto.guest_id &&
                  obj.guest_user_id === headers?.guest_user_id
                );
              }
            });
          } else if (
            headers?.guest_user_id &&
            !removeCartDto.guest_id &&
            (removeCartDto.services_id || removeCartDto?.package_id)
          ) {
            serviceSlotsIndex = getExistingData.findIndex((obj) => {
              if (removeCartDto?.package_id) {
                return (
                  obj?.package_id === removeCartDto?.package_id &&
                  obj.guest_user_id === headers?.guest_user_id
                );
              } else {
                return (
                  obj.service_id === removeCartDto.services_id &&
                  obj.guest_user_id === headers?.guest_user_id &&
                  !obj.guest_id
                );
              }
            });
          } else if (
            headers?.guest_user_id &&
            !removeCartDto.guest_id &&
            (!removeCartDto.services_id || !removeCartDto?.package_id)
          ) {
            serviceSlotsIndex = getExistingData.findIndex((obj) => {
              if (removeCartDto?.package_id) {
                return obj.guest_user_id === headers?.guest_user_id;
              } else {
                return obj.guest_user_id === headers?.guest_user_id;
              }
            });
          } else {
            throw new Error(Language.ERROR.ERR_CART_ITEM_NOT_FOUND);
          }

          //Remove cart with time check part
          const range = [];
          let midTimeList = [];
          let lastIndex = false;
          const totalSelIndex = serviceSlotsIndex + 1;
          if (
            getExistingData.length > 1 &&
            getExistingData[serviceSlotsIndex]?.time_from
          ) {
            if (serviceSlotsIndex === 0) {
              range.push(
                getExistingData[serviceSlotsIndex].time_from,
                getExistingData[serviceSlotsIndex].time_to,
              );
            }
            //Checking mid record
            if (
              getExistingData.length != serviceSlotsIndex &&
              serviceSlotsIndex != 0
            ) {
              midTimeList.push(
                getExistingData[serviceSlotsIndex].time_from,
                getExistingData[serviceSlotsIndex].time_to,
              );
            }
            //Checking whether it is last index
            if (getExistingData.length === totalSelIndex) {
              lastIndex = true;
            }
          } else {
            // Here:: 8645
            this.addEditAppointmentKey(getExistingData, serviceSlotsIndex);
            getExistingData.splice(serviceSlotsIndex, 1);

            if (getExistingData.length === 0) {
              await this.redisService.del(key);
            } else {
              const timeFromCount = getExistingData?.filter(
                (item) => !item.time_from,
              );
              if (timeFromCount?.length === getExistingData?.length) {
                await this.redisService.set(key, getExistingData);
              } else {
                await this.redisService.set(key, getExistingData, ttl);
              }
              //await this.redisService.set(key, getExistingData, ttl);
            }
            return;
          }
          //Remove cart with time update record and set record part
          if (serviceSlotsIndex > -1) {
            // Here:: 8645
            this.addEditAppointmentKey(getExistingData, serviceSlotsIndex);
            getExistingData.splice(serviceSlotsIndex, 1);
            if (getExistingData.length === 0) {
              await this.redisService.del(key);
            } else {
              if (getExistingData.length >= 1 && lastIndex == false) {
                let previousTimeList = [];
                const storeData = await this.getStoreDetails(
                  getExistingData[0]['store_id'],
                  null,
                  headers.domain_name,
                );
                const storeTimezone =
                  '(' + storeData?.timezone.toUpperCase() + ')';
                getExistingData.forEach(function (itemList, index) {
                  if (index === 0 && range.length > 0) {
                    if (removeCartDto?.is_new_slot_accept === 0) {
                      const startDate = moment(range[0]).format(
                        Constant.DATE_FORMAT.LLL,
                      );
                      const messageStart =
                        Language.SUCESS.MSG_NEW_SLOT_TIME.replace(
                          '<appointment start>',
                          startDate + ' ' + storeTimezone,
                        );
                      statusMessage = messageStart;
                    } else {
                      const endTime = moment(range[0])
                        .add(itemList.approx_time, 'minutes')
                        .format('YYYY-MM-DDTHH:mm:59');
                      itemList.time_from = range[0];
                      itemList.time_to = endTime;
                    }
                  } else {
                    if (
                      previousTimeList.length > 0 &&
                      midTimeList.length === 0
                    ) {
                      if (removeCartDto?.is_new_slot_accept === 0) {
                        const startDate = moment(previousTimeList[0]).format(
                          Constant.DATE_FORMAT.LLL,
                        );
                        const messageStart =
                          Language.SUCESS.MSG_NEW_SLOT_TIME.replace(
                            '<appointment start>',
                            startDate + ' ' + storeTimezone,
                          );
                        statusMessage = messageStart;
                      } else {
                        if (previousTimeList[0] < itemList.time_from) {
                          const endTime = moment(previousTimeList[0])
                            .add(itemList.approx_time, 'minutes')
                            .format('YYYY-MM-DDTHH:mm:59');
                          itemList.time_from = previousTimeList[0];
                          itemList.time_to = endTime; //previousTimeList[1];
                          previousTimeList = [];
                        }
                      }
                    } else if (midTimeList.length > 0) {
                      if (removeCartDto?.is_new_slot_accept === 0) {
                        const startDate = moment(midTimeList[0]).format(
                          Constant.DATE_FORMAT.LLL,
                        );
                        const messageStart =
                          Language.SUCESS.MSG_NEW_SLOT_TIME.replace(
                            '<appointment start>',
                            startDate + ' ' + storeTimezone,
                          );
                        statusMessage = messageStart;
                      } else {
                        if (midTimeList[0] < itemList.time_from) {
                          previousTimeList.push(
                            itemList.time_from,
                            itemList.time_to,
                          );
                          const endTime = moment(midTimeList[0])
                            .add(itemList.approx_time, 'minutes')
                            .format('YYYY-MM-DDTHH:mm:00');
                          itemList.time_from = midTimeList[0];
                          itemList.time_to = endTime; //midTimeList[1];
                          midTimeList = [];
                        }
                      }
                    }
                  }
                });
              }
              if (!statusMessage) {
                const timeFromCount = getExistingData?.filter(
                  (item) => !item.time_from,
                );
                if (timeFromCount?.length === getExistingData?.length) {
                  await this.redisService.set(key, getExistingData);
                } else {
                  if (ttl <= 0) {
                    await this.redisService.set(
                      key,
                      getExistingData,
                      Constant.REDIS.TTL,
                    );
                  } else {
                    await this.redisService.set(key, getExistingData, ttl);
                  }
                }
                //await this.redisService.set(key, getExistingData, ttl);
              }
            }
          } else {
            throw new Error(Language.ERROR.ERR_CART_ITEM_NOT_FOUND);
          }
        } else {
          let foundIndexes = [];
          if (
            headers?.customer_id &&
            !headers?.guest_user_id &&
            !removeCartDto?.guest_id
          ) {
            foundIndexes = getExistingData.reduce((r, n, i) => {
              n.customer_id === headers?.customer_id &&
                !n.guest_id &&
                r.push(i);
              return r;
            }, []);
          } else if (
            headers?.customer_id &&
            !headers?.guest_user_id &&
            removeCartDto?.guest_id
          ) {
            foundIndexes = getExistingData.reduce((r, n, i) => {
              n.guest_id === removeCartDto?.guest_id && r.push(i);
              return r;
            }, []);
          } else if (
            headers?.guest_user_id &&
            !headers?.customer_id &&
            !removeCartDto?.guest_id
          ) {
            foundIndexes = getExistingData.reduce((r, n, i) => {
              n.guest_user_id === headers?.guest_user_id &&
                !n.guest_id &&
                r.push(i);
              return r;
            }, []);
          } else if (
            headers?.guest_user_id &&
            !headers?.customer_id &&
            removeCartDto.guest_id
          ) {
            foundIndexes = getExistingData.reduce((r, n, i) => {
              n.guest_user_id === headers?.guest_user_id &&
                n.guest_id === removeCartDto.guest_id &&
                r.push(i);
              return r;
            }, []);
          }
          if (foundIndexes.length > 0) {
            for (let i = foundIndexes.length - 1; i >= 0; i--) {
              // Here:: 8645
              this.addEditAppointmentKey(getExistingData, serviceSlotsIndex);
              await getExistingData.splice(foundIndexes[i], 1);
            }
            if (getExistingData.length === 0) {
              await this.redisService.del(key);
            } else {
              const timeFromCount = getExistingData?.filter(
                (item) => !item.time_from,
              );
              if (timeFromCount?.length === getExistingData?.length) {
                await this.redisService.set(key, getExistingData);
              } else {
                if (ttl <= 0) {
                  await this.redisService.set(
                    key,
                    getExistingData,
                    Constant.REDIS.TTL,
                  );
                } else {
                  await this.redisService.set(key, getExistingData, ttl);
                }
              }
              //await this.redisService.set(key, getExistingData, ttl);
            }
          } else {
            throw new Error(Language.ERROR.ERR_CART_NOT_FOUND);
          }
          //await this.redisService.del(key)
        }
        this.logger.info(`CustomerJourneyService : Exit removeFromCart Method`);
        this.ECSlogger.info(
          `CustomerJourneyService : Exit removeFromCart Method`,
        );
        if (!statusMessage) {
          return statusMessage;
        } else {
          return {
            error_message: statusMessage,
            error_type: 'continue_slots',
            status: false,
          };
        }
      } else {
        throw new Error(Language.ERROR.ERR_CART_NOT_FOUND);
      }
    } catch (err) {
      throw err;
    }
  }

  async getImage(image, tenant_id) {
    this.logger.info(`CustomerJourneyService : Enter getImage Method`);
    this.ECSlogger.info(`CustomerJourneyService : Enter getImage Method`);

    let storeImage;
    //Get store image
    if (image) {
      storeImage = image;
    } else {
      const configObj = await this.appointmentService.getFranchisorConfig(
        tenant_id,
      );
      storeImage = configObj['default_store_image'] || '';
    }

    this.logger.info(`CustomerJourneyService : Enter getImage Method`);
    this.ECSlogger.info(`CustomerJourneyService : Enter getImage Method`);

    return storeImage;
  }

  async getBookedSlots(startDate: string, endDate: string, tenant_id: string) {
    try {
      const query = `
        select DISTINCT ON (exp_start_date, exp_end_date, client_id, guest_user_id)
          json_build_object('time_from', exp_start_date, 'time_to', exp_end_date,'store_id', store_id, 'cutter_id', cutter_id, 'service_id', service_id, 'package_id', package_id, 'tenant_id', tenant_id, 'customer_id', client_id, 'db_booked_slot', 1, 'guest_id', guest_user_id, 'appointment_id', appointment_id) as slots
        from mv_appointments where 
          exp_start_date >= '${startDate}' AND exp_end_date <= '${endDate}' AND tenant_id = '${tenant_id}' AND (is_cancelled is NULL OR cancellation_reason = 'No show')
      `;

      const data = await this.appointmentViewRepository.query(query);

      if (data?.length) {
        const slots = [];
        for (const obj of data) {
          slots.push(obj.slots);
        }
        return slots;
      } else {
        return [];
      }
    } catch (err) {
      throw err;
    }
  }

  async getBookedSlotsByUser(
    startDate: string,
    endDate: string,
    tenant_id: string,
    client_id: string,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter getBookedSlotsByUser Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter getBookedSlotsByUser Method`,
      );
      const query = `
        select DISTINCT ON (exp_start_date, exp_end_date, client_id, guest_user_id)
          json_build_object('time_from', exp_start_date, 'time_to', exp_end_date,'store_id', store_id, 'cutter_id', cutter_id, 'service_id', service_id, 'package_id', package_id, 'tenant_id', tenant_id, 'customer_id', client_id, 'db_booked_slot', 1, 'guest_id', guest_user_id, 'appointment_id', appointment_id) as slots
        from mv_appointments where 
          exp_start_date >= '${startDate}' AND exp_end_date <= '${endDate}' AND tenant_id = '${tenant_id}' AND is_cancelled is NULL AND client_id = '${client_id}'
      `;

      const data = await this.appointmentViewRepository.query(query);

      this.logger.info(
        `CustomerJourneyService : Exit getBookedSlotsByUser Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit getBookedSlotsByUser Method`,
      );

      if (data?.length) {
        const slots = [];
        for (const obj of data) {
          slots.push(obj.slots);
        }
        return slots;
      } else {
        return [];
      }
    } catch (err) {
      throw err;
    }
  }

  async fetchNearbyStores(
    latitude,
    longitude,
    paginationObj: any,
    tenant_id: any,
    domain_name: string,
    customer_id: string,
    headers: any,
    googleMatrixStatus: any,
  ) {
    this.logger.info(`CustomerJourneyService : Enter fetchNearbyStores Method`);
    this.ECSlogger.info(
      `CustomerJourneyService : Enter fetchNearbyStores Method`,
    );

    const getNearbyDistance = tenant_id
      ? await this.franchisorConfigRepository.query(
          `select value from config_franchisor_config where category = 'appointment_service_config' AND tenant_id = '${tenant_id}'`,
        )
      : `${process.env.NEARBY_DISTANCE}`;
    const nearByDistance =
      tenant_id && getNearbyDistance[0]
        ? getNearbyDistance[0].value['near_by_distance']
        : `${process.env.NEARBY_DISTANCE}`;

    const nearbyRecords = [];
    const query = `select Distinct(id), name, service_count, franchisor_name, geo_lat, geo_long, logo, description, country, state , city, address, street_name, zipcode, status,timezone, is_deleted,
    CAST(distance as decimal(10,2)) from (SELECT
          stores.id,  (SELECT COUNT(DISTINCT services.service_id) FROM public.mv_services services WHERE stores.id = services.store_id AND services.status = 'active') AS service_count, stores.name, stores.franchisor_name, stores.geo_lat, stores.geo_long, stores.logo, stores.timezone,
                        stores.description, stores.country, stores.state , stores.city, stores.address, stores.street_name, stores.zipcode, stores.status, stores.is_deleted, (
      3959 * acos (
        cos ( radians(${latitude}) )
        * cos( radians(cast (geo_lat as DOUBLE PRECISION) ))
        * cos( radians(cast(geo_long as DOUBLE PRECISION)) - radians(${longitude}) )
        + sin ( radians(${latitude}) )
        * sin( radians(cast (geo_lat as DOUBLE PRECISION) ))
      )
    ) AS distance
  FROM public.mv_stores stores WHERE tenant_id = '${tenant_id}') as distance Where distance <= ${nearByDistance} AND distance.status = '2' AND distance.is_deleted = false ORDER BY distance ASC`;

    const nearbyStoresDetails = await this.storeDetailRepository.query(
      `${query} LIMIT ${paginationObj.limit} OFFSET ${
        (paginationObj.skip - 1) * paginationObj.limit
      };`,
    );

    // fetch customer's favourite data
    let fav_stores = [];
    if (customer_id) {
      const [customerProfile] = await this.customerViewRepository.query(`
        SELECT * FROM mv_customer where customer_id = '${customer_id}'
      `);

      fav_stores = customerProfile?.fav_stores
        ? customerProfile?.fav_stores.map((obj) => obj.store_id)
        : [];
    }

    const totalRecords = await this.storeDetailRepository.query(`${query}`);
    const configObj = await this.getFranchisorConfig(tenant_id);

    const valueDetails = nearbyStoresDetails;
    if (valueDetails && valueDetails.length > 0) {
      for (const value of valueDetails) {
        value['rating'] = 3;

        // assign favourite flag
        if (fav_stores?.length && fav_stores.find((fav) => fav === value.id)) {
          value['is_store_favourite'] = true;
        } else {
          value['is_store_favourite'] = false;
        }
        // Get store images/logo
        if (value.logo) {
          value['presigned_url'] = value.logo;
          value['logo'] = value.logo;
        } else {
          value['presigned_url'] = configObj['default_store_image'] || '';
          value['logo'] = configObj['default_store_image'] || '';
        }
        // Making use of google API to calculate estimated travel time
        /*try {
          let getTravelTime;
          if (
            googleMatrixStatus &&
            googleMatrixStatus.toLowerCase() === 'true'
          ) {
            getTravelTime = await this.(
              latitude,
              longitude,
              value['geo_lat'],
              value['geo_long'],
            );
          }*/
        value['estimated_time'] = '-';
        value['estimated_time_sec'] = 0;
        /*} catch (error) {
          return error.response;
        }*/
        nearbyRecords.push(value);
      }
    }

    this.logger.info(`CustomerJourneyService : Exit fetchNearbyStores Method`);
    this.ECSlogger.info(
      `CustomerJourneyService : Exit fetchNearbyStores Method`,
    );

    return {
      nearbyRecords: nearbyStoresDetails,
      totalCount: totalRecords.length,
    };
  }

  async getFranchisorConfig(tenant_id: string) {
    this.logger.info(
      `CustomerJourneyService : Enter getFranchisorConfig Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter getFranchisorConfig Method`,
    );
    const response = {};
    // GET default config images
    const [configObj] = await this.franchisorConfigRepository.find({
      where: {
        category: 'default_images_config',
        tenant_id: tenant_id,
      },
    });
    if (configObj.value['service_image']) {
      response['default_service_image'] = configObj.value['service_image'];
    }

    if (configObj.value['package_image']) {
      response['default_service_image'] = configObj.value['package_image'];
    }

    if (configObj.value['store_image']) {
      response['default_store_image'] = configObj.value['store_image'];
    }

    if (configObj.value['product_image']) {
      response['default_product_image'] = configObj.value['product_image'];
    }

    if (configObj.value['cutter_image']) {
      response['default_cutter_image'] = configObj.value['cutter_image'];
    }

    if (configObj.value['customer_image']) {
      response['default_customer_image'] = configObj.value['customer_image'];
    }
    this.logger.info(
      `CustomerJourneyService : Exit getFranchisorConfig Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit getFranchisorConfig Method`,
    );
    return response;
  }

  async findPreviousAppointments(appointmentDto: AppointmentDto): Promise<any> {
    this.logger.info(
      `CustomerJourneyService : Enter findPreviousAppointments Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter findPreviousAppointments Method`,
    );
    const todayDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_END);
    const query = {
      relations: [
        'service_booked',
        'customer_details',
        'customer_guest_details',
      ],
      where: [
        {
          client_id: appointmentDto.customer_id,
          appointment_time: LessThanOrEqual(todayDate),
          status: Not('booked'),
        },
        {
          client_id: appointmentDto.customer_id,
          appointment_time: LessThanOrEqual(todayDate),
          status: Not('booked'),
        },
      ],
    };
    query['order'] = {
      appointment_time: 'DESC',
    };
    let appointments = await this.appointmentRepository.find(query);
    appointments = appointments.filter((a) => {
      return a.service_booked && a.service_booked.length > 0;
    });

    appointments = await this.filterAppointmentsBasedOnTimeZone(
      appointments,
      'previous',
    );

    const totalCount = appointments.length;

    if (appointmentDto.start && appointmentDto.limit) {
      appointments = appointments.slice(
        (appointmentDto.start - 1) * appointmentDto.limit,
        appointmentDto.start * appointmentDto.limit,
      );
    }
    appointments = await this.getAppoinmentDetails(
      appointments,
      appointmentDto.tenant_id,
    );
    this.logger.info(
      `CustomerJourneyService : Exit findPreviousAppointments Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit findPreviousAppointments Method`,
    );
    return { appointments, totalCount };
  }

  async appointmentWaitList(
    appointmentDto: AppointmentServiceDto,
    pin,
    headers: any,
  ): Promise<any> {
    this.logger.info(
      `CustomerJourneyService : Enter appintmentWaitList Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter appintmentWaitList Method`,
    );

    const response = {
      store_address: '',
      store_current_time: '',
      total_record_wait_list: 0,
      next_customer_wait_time: 0,
      storeName: '',
      timeZone: '',
      appointment_data: [],
      isStoreClose: false,
      isCutterScheduled: true,
      noWait: false,
    };

    try {
      if (pin !== undefined) {
        let configObj = await this.franchisorConfigRepository.find({
          tenant_id: appointmentDto.tenant_id,
        });
        configObj = configObj.filter((data) => {
          return data.category === 'in_store';
        });

        const [configData] = configObj;

        const secret_pin = configData['value']['secret_pin'];

        if (secret_pin !== pin) {
          throw new Error(Language.ERROR.ERR_INVALID_PIN);
        }
      } else {
        throw new Error(Language.ERROR.ERR_INVALID_PIN);
      }
    } catch (e) {
      throw new Error(Language.ERROR.ERR_INVALID_PIN);
    }

    try {
      if (appointmentDto?.store_id) {
        const [configObj] = await this.franchisorConfigRepository.find({
          where: {
            category: 'appointment_service_config',
            tenant_id: headers.tenant_id,
          },
        });

        const sleeping_time = configObj?.value
          ? +configObj.value['sleeping_time']
          : +Constant.sleeping_time;

        const allStoreDetails = await this.storeDetailRepository.query(`
          SELECT * FROM public.mv_stores where numeric_store_id = '${appointmentDto?.store_id}'
        `);

        //   const [storeData] = await this.storeDetailRepository.query(`
        //   SELECT * FROM public.mv_stores where id = '${appointmentDto?.store_id}'
        // `);
        const storeUuid = allStoreDetails[0].id;

        const tzOffset =
          Constant.timezones[allStoreDetails[0]?.timezone] || 'UTC';

        const storeCurrentDate = moment()
          .tz(tzOffset)
          .format(Constant.DATE_FORMAT.YMD_THMD);

        const dateWithSleepingTime = moment(storeCurrentDate)
          .add(sleeping_time, 'minutes')
          .format(Constant.DATE_FORMAT.YMD_HMD_START_SECOND);

        const storeEndCurrentDate = moment()
          .tz(tzOffset)
          .format(Constant.DATE_FORMAT.YMD_HMD_END);

        const dayName = moment().tz(tzOffset).format(Constant.DATE_FORMAT.DDDD);

        const storeData = allStoreDetails.find(
          (obj) => obj['weekday'] === dayName,
        );

        const storeAddress =
          storeData?.address +
          ', ' +
          storeData?.street_name +
          ', ' +
          storeData?.suite_number +
          storeData?.city +
          ', ' +
          storeData?.state +
          ', ' +
          storeData?.zipcode +
          '';

        response.store_address = storeAddress;
        response.store_current_time = storeCurrentDate;
        response.storeName = storeData.name;
        response.timeZone = storeData.timezone;
        response['isStoreActive'] = storeData.status;
        // check store is open or not
        if (!storeData?.store_open_time && !storeData.store_close_time) {
          response['isStoreClose'] = true;
          return response;
        }

        // check cutter is schedule or not
        const startDate = moment()
          .tz(tzOffset)
          .format(Constant.DATE_FORMAT.YMD_HMD_START);

        const endDate = moment()
          .tz(tzOffset)
          .format(Constant.DATE_FORMAT.YMD_HMD_END);

        const scheduleQuery = `SELECT employee_id from mv_cutter_schedule WHERE
          shift_start_time >= '${startDate}' AND shift_end_time <= '${endDate}' AND store_id = '${storeUuid}'`;

        const cutterData = await this.cutterScheduleRepository.query(
          scheduleQuery,
        );

        if (cutterData?.length == 0) {
          response['isCutterScheduled'] = false;
          return response;
        }

        // calculate if any slot is near to current time
        const storeDateObj = await this.calculateDateRange(
          storeData.store_open_time,
          storeData.store_end_time,
          storeCurrentDate,
          moment().tz(tzOffset).format(Constant.DATE_FORMAT.YMD),
        );

        // const slotQuery = await this.customerJourneyUtility.cutterSlotQuery(
        //   storeUuid,
        //   moment(storeDateObj.startDate)
        //     .set('seconds', 0)
        //     .format(Constant.DATE_FORMAT.YMD_THMD),
        //   storeDateObj.endDate,
        // );

        // existing checkCutterAvailability function
        let bookedSlots = await this.getRedisCartDetails();
        const bookedSlotsFromDB = await this.getBookedSlots(
          moment(storeDateObj.startDate).format(
            Constant.DATE_FORMAT.YMD_HMD_START,
          ),
          moment(storeDateObj.endDate).format(Constant.DATE_FORMAT.YMD_HMD_END),
          headers.tenant_id,
        );
        bookedSlots = [...bookedSlots, ...bookedSlotsFromDB];
        bookedSlots = bookedSlots.filter((slot) => slot.store_id == storeUuid);
        const cutters = await this.newCheckCutterAvailability(
          'slots',
          storeUuid,
          moment(storeDateObj.startDate).format(
            Constant.DATE_FORMAT.YMD_HMD_START,
          ),
          moment(storeDateObj.endDate).format(Constant.DATE_FORMAT.YMD_HMD_END),
          1,
          0,
          headers.tenant_id,
          null,
          bookedSlots,
        );

        let slots = [];
        for (const obj of cutters) {
          slots.push(...obj.cutter_availability);
        }

        slots = orderBy(slots, ['time_from'], ['asc']);
        // const slots = await this.cutterScheduleRepository.query(slotQuery);

        slots = slots.filter(
          (obj) => new Date(obj.time_from) >= new Date(storeCurrentDate),
        );
        if (slots.length) {
          // calculate remainging time
          let next_customer_wait_time =
            moment(new Date(slots[0].time_from)).diff(
              moment(new Date(storeCurrentDate)),
              'minutes',
            ) || 0;

          next_customer_wait_time =
            next_customer_wait_time <= 0 ? 0 : next_customer_wait_time;
          response.next_customer_wait_time = next_customer_wait_time;

          const newCurrentDate = moment(storeCurrentDate)
            .set('seconds', 0)
            .format(Constant.DATE_FORMAT.YMD_THMD);

          if (next_customer_wait_time == 0) {
            response.noWait = true;
          }

          // Check for earliest shift of cutter regardless of store open time
          // const query = `SELECT shift_start_time AS shift_start_time FROM public.mv_cutter_schedule
          //   WHERE tenant_id='${appointmentDto.tenant_id}' AND store_id='${storeUuid}' AND
          //   shift_type = 'shift' AND shift_start_time::date='${moment(storeCurrentDate).format(Constant.DATE_FORMAT.YMD)}'
          //   ORDER BY shift_start_time ASC
          //   LIMIT 1`;

          // const [queryResult] = await this.cutterScheduleRepository.query(query);
          // const firstTime = queryResult?.shift_start_time ? moment(queryResult.shift_start_time).format(Constant.DATE_FORMAT.YMD_HMD) : slots[0].time_from;
          if (new Date(slots[0].time_from) < new Date(storeCurrentDate)) {
            for (const dateObj of slots) {
              if (
                dateObj.time_from.toString() === newCurrentDate.toString() ||
                new Date(dateObj.time_from) >= new Date(newCurrentDate)
              ) {
                response.noWait = true;
                break;
              }
            }
          }
          // const noWaitSlot = slots.find(
          //   (s) => s.time_from.toString() === newCurrentDate.toString(),
          // );
          // if (noWaitSlot) {
          //   response.noWait = true;
          // }
        }

        //const todayDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_END);
        const query = {
          relations: [
            'service_booked',
            'customer_details',
            'customer_guest_details',
          ],
          where: [
            {
              appointment_time: Between(
                new Date(storeCurrentDate),
                new Date(storeEndCurrentDate),
              ),
              status: In(['booked', 'rescheduled', 'checked_in']),
            },
          ],
        };
        query['order'] = {
          appointment_time: 'ASC',
        };
        let appointments = (await this.appointmentRepository.find(query)) || [];
        const finalData = [];
        appointments.forEach((a) => {
          const found = a.service_booked.find(
            (obj) => obj.store_id === storeUuid,
          );

          if (found) {
            finalData.push(a);
          }
          // a.service_booked.forEach((b) => {
          //   if (b.store_id === storeUuid) {
          //     finalData.push(a);
          //   }
          // });
        });

        appointments = finalData;

        for (let i = 0; i < appointments.length; i++) {
          if (appointments[i].appointment_time) {
            const appointmentDate = moment(
              appointments[i].appointment_time,
            ).format(Constant.DATE_FORMAT.YMD_THMD);
            if (new Date(appointmentDate) < new Date(storeCurrentDate)) {
              appointments = appointments.splice(i, 1);
              break;
            }
          }
        }

        let finalAppointment = [];

        if (appointments.length !== 0) {
          //const configObj = await this.getFranchisorConfig(appointmentDto?.tenant_id);
          for (const appointment of appointments) {
            if (appointment?.customer_guest_details) {
              appointment['customer_name'] =
                appointment.customer_guest_details.name;
            } else {
              appointment['customer_name'] =
                appointment.customer_details.fullname;
            }

            // const appointmentDate = moment(appointment.appointment_time).format(
            //   Constant.DATE_FORMAT.YMD_THMD,
            // );
            // const estimated_remaining_time = moment(
            //   new Date(appointmentDate),
            // ).diff(moment(new Date(storeCurrentDate)), 'minutes');
            const packages = {};
            if (
              appointment.service_booked &&
              appointment.service_booked.length
            ) {
              for (const service of appointment.service_booked) {
                if (service.guest_name && appointment.customer_details) {
                  // appointment['customer_name'] = service?.guest_name;
                  appointment['customer_name'] =
                    appointment.customer_details.fullname;
                  appointment['guest_name'] = service?.guest_name;
                }

                if (appointment?.customer_guest_details) {
                  appointment['customer_name'] =
                    appointment.customer_guest_details.name;
                } else if (
                  appointment?.customer_details &&
                  !service.guest_name
                ) {
                  appointment['customer_name'] =
                    appointment.customer_details.fullname;
                }
                if (service.cutter_id) {
                  const cutterData =
                    await this.cutterScheduleRepository.findOne({
                      employee_user_id: service.cutter_id,
                    });
                  if (cutterData) {
                    appointment[
                      'cutter_name'
                    ] = `${cutterData?.firstname} ${cutterData?.lastname}`;
                  }
                }

                const appointmentServiceDate = moment(
                  service.exp_start_date,
                ).format(Constant.DATE_FORMAT.YMD_THMD);

                const estimated_remaining_time = moment(
                  new Date(appointmentServiceDate),
                ).diff(moment(new Date(storeCurrentDate)), 'minutes');

                if (service.package_id && packages[service.package_id]) {
                  packages[service.package_id] = estimated_remaining_time;
                } else {
                  const finalObj = {
                    appointment_id: appointment['id'],
                    customer_name: appointment['customer_name'],
                    guest_name: appointment['guest_name'],
                    cutter_name: appointment['cutter_name'],
                    estimated_remaining_time,
                  };
                  if (service.package_id) {
                    packages[service.package_id] = estimated_remaining_time;
                  }
                  finalAppointment.push(finalObj);
                }
              }
            }

            // const [userData] = await this.customerViewRepository.query(`
            //   SELECT id, fullname FROM customer_user where id = '${appointment.client_id}'
            // `);

            // let customer_name = userData?.fullname;
            // if (appointment.guest_user_id) {
            //   const [guestData] = await this.customerViewRepository.query(`
            //     SELECT id, name FROM customer_guest_user where id = '${appointment.guest_user_id}'
            //   `);
            //   customer_name = guestData.name;
            // }
            // const finalObj = {
            //   appointment_id: appointment['id'],
            //   customer_name: appointment['customer_name'],
            //   cutter_name: appointment['cutter_name'],
            //   estimated_remaining_time,
            // };
            // finalAppointment.push(finalObj);
          }
        }
        // if (finalAppointment.length) {
        //   response.next_customer_wait_time =
        //     finalAppointment[finalAppointment.length - 1][
        //       'estimated_remaining_time'
        //     ];
        // } else {
        //   response.next_customer_wait_time = 0;
        // }

        finalAppointment = orderBy(
          finalAppointment,
          ['estimated_remaining_time'],
          ['asc'],
        );

        response.total_record_wait_list = +finalAppointment.length || 0;
        response.appointment_data = finalAppointment;
        return response;
      } else {
        throw new Error(Language.ERROR.ERR_STORE_NOT_FOUND);
      }
    } catch (e) {
      throw new Error(Language.ERROR.ERR_STORE_NOT_FOUND);
    }
  }

  async findUpcomingAppointments(appointmentDto: AppointmentDto): Promise<any> {
    this.logger.info(
      `CustomerJourneyService : Enter findUpcomingAppointments Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter findUpcomingAppointments Method`,
    );
    let query;
    if (appointmentDto.customer_id) {
      const todayDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_START);
      query = {
        relations: [
          'service_booked',
          'customer_details',
          'customer_guest_details',
        ],
        where: [
          {
            client_id: appointmentDto.customer_id,
            appointment_time: MoreThan(todayDate),
            status: In(['booked', 'rescheduled']),
          },
          {
            client_id: appointmentDto.customer_id,
            appointment_time: MoreThan(todayDate),
            status: 'completed',
            is_cancelled: true,
          },
        ],
      };
    } else if (appointmentDto.store_id) {
      query = {
        relations: [
          'service_booked',
          'customer_details',
          'customer_guest_details',
        ],
        where: (qb) => {
          qb.where('Appointment__service_booked.cutter_id = :employee_id', {
            employee_id: appointmentDto.employee_id,
          })
            .andWhere('Appointment__service_booked.store_id = :store_id', {
              store_id: appointmentDto.store_id,
            })
            .andWhere(
              `"Appointment"."appointment_time" BETWEEN :begin AND :end`,
              {
                begin: this.utilityService.getStartOfTheDay(
                  appointmentDto.date,
                ),
                end: this.utilityService.getEndOfTheDay(appointmentDto.date),
              },
            )
            .andWhere('Appointment.status IN(:...statuses)', {
              statuses: ['booked', 'rescheduled'],
            });
        },
      };
    } else {
      query = {
        relations: [
          'service_booked',
          'customer_details',
          'customer_guest_details',
        ],
        where: (qb) => {
          qb.where('Appointment__service_booked.cutter_id = :employee_id', {
            employee_id: appointmentDto.employee_id,
          })
            .andWhere(
              `"Appointment"."appointment_time" BETWEEN :begin AND :end`,
              {
                begin: this.utilityService.getStartOfTheDay(
                  appointmentDto.date,
                ),
                end: this.utilityService.getEndOfTheDay(appointmentDto.date),
              },
            )
            .andWhere('Appointment.status IN(:...statuses)', {
              statuses: ['booked', 'rescheduled'],
            });
        },
      };
    }
    query['order'] = {
      appointment_time: 'ASC',
    };
    let appointments = await this.appointmentRepository.find(query);

    appointments = await this.getAppoinmentDetails(
      appointments,
      appointmentDto.tenant_id,
    );
    appointments = appointments.filter((a) => {
      return a.service_booked && a.service_booked.length > 0;
    });

    appointments = await this.filterAppointmentsBasedOnTimeZone(
      appointments,
      'upcoming',
    );

    const totalCount = appointments.length;

    if (appointmentDto.start && appointmentDto.limit) {
      appointments = appointments.slice(
        (appointmentDto.start - 1) * appointmentDto.limit,
        appointmentDto.start * appointmentDto.limit,
      );
    }

    this.logger.info(
      `CustomerJourneyService : Exit findUpcomingAppointments Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit findUpcomingAppointments Method`,
    );
    return { appointments, totalCount };
  }

  async findOngingAppointments(appointmentDto: AppointmentDto): Promise<any> {
    this.logger.info(
      `CustomerJourneyService : Enter findOngingAppointments Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter findOngingAppointments Method`,
    );
    let query;
    if (appointmentDto.store_id) {
      query = {
        relations: [
          'service_booked',
          'customer_details',
          'customer_guest_details',
        ],
        where: (qb) => {
          qb.where('Appointment__service_booked.cutter_id = :employee_id', {
            employee_id: appointmentDto.employee_id,
          })
            .andWhere('Appointment__service_booked.store_id = :store_id', {
              store_id: appointmentDto.store_id,
            })
            .andWhere(
              `"Appointment"."appointment_time" BETWEEN :begin AND :end`,
              {
                begin: this.utilityService.getStartOfTheDay(
                  appointmentDto.date,
                ),
                end: this.utilityService.getEndOfTheDay(appointmentDto.date),
              },
            )
            .andWhere('Appointment.status IN(:...statuses)', {
              statuses: ['ongoing', 'checked_in', 'checked_out'],
            });
        },
      };
    } else {
      query = {
        relations: [
          'service_booked',
          'customer_details',
          'customer_guest_details',
        ],
        where: (qb) => {
          qb.where('Appointment__service_booked.cutter_id = :employee_id', {
            employee_id: appointmentDto.employee_id,
          })
            .andWhere(
              `"Appointment"."appointment_time" BETWEEN :begin AND :end`,
              {
                begin: this.utilityService.getStartOfTheDay(
                  appointmentDto.date,
                ),
                end: this.utilityService.getEndOfTheDay(appointmentDto.date),
              },
            )
            .andWhere('Appointment.status IN(:...statuses)', {
              statuses: ['ongoing', 'checked_in', 'checked_out'],
            });
        },
      };
    }
    query['order'] = {
      appointment_time: 'ASC',
    };
    let appointments = await this.appointmentRepository.find(query);
    appointments = await this.getAppoinmentDetails(
      appointments,
      appointmentDto.tenant_id,
    );
    appointments = appointments.filter((a) => {
      return a.service_booked && a.service_booked.length > 0;
    });

    const totalCount = appointments.length;

    if (appointmentDto.start && appointmentDto.limit) {
      appointments = appointments.slice(
        (appointmentDto.start - 1) * appointmentDto.limit,
        appointmentDto.start * appointmentDto.limit,
      );
    }

    this.logger.info(
      `CustomerJourneyService : Exit findOngingAppointments Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit findOngingAppointments Method`,
    );
    return { appointments, totalCount };
  }

  async findCompletedAppointments(
    appointmentDto: AppointmentDto,
  ): Promise<any> {
    this.logger.info(
      `CustomerJourneyService : Enter findCompletedAppointments Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter findCompletedAppointments Method`,
    );
    let query;
    if (appointmentDto.store_id) {
      query = {
        relations: [
          'service_booked',
          'customer_details',
          'customer_guest_details',
        ],
        where: (qb) => {
          qb.where('Appointment__service_booked.cutter_id = :employee_id', {
            employee_id: appointmentDto.employee_id,
          })
            .andWhere('Appointment__service_booked.store_id = :store_id', {
              store_id: appointmentDto.store_id,
            })
            .andWhere(
              `"Appointment"."appointment_time" BETWEEN :begin AND :end`,
              {
                begin: this.utilityService.getStartOfTheDay(
                  appointmentDto.date,
                ),
                end: this.utilityService.getEndOfTheDay(appointmentDto.date),
              },
            )
            .andWhere('Appointment.status = :status', { status: 'completed' });
        },
      };
    } else {
      query = {
        relations: [
          'service_booked',
          'customer_details',
          'customer_guest_details',
        ],
        where: (qb) => {
          qb.where('Appointment__service_booked.cutter_id = :employee_id', {
            employee_id: appointmentDto.employee_id,
          })
            .andWhere(
              `"Appointment"."appointment_time" BETWEEN :begin AND :end`,
              {
                begin: this.utilityService.getStartOfTheDay(
                  appointmentDto.date,
                ),
                end: this.utilityService.getEndOfTheDay(appointmentDto.date),
              },
            )
            .andWhere('Appointment.status = :status', { status: 'completed' });
        },
      };
    }
    query['order'] = {
      appointment_time: 'ASC',
    };
    let appointments = await this.appointmentRepository.find(query);
    appointments = await this.getAppoinmentDetails(
      appointments,
      appointmentDto.tenant_id,
    );
    appointments = appointments.filter((a) => {
      return a.service_booked && a.service_booked.length > 0;
    });

    const totalCount = appointments.length;

    if (appointmentDto.start && appointmentDto.limit) {
      appointments = appointments.slice(
        (appointmentDto.start - 1) * appointmentDto.limit,
        appointmentDto.start * appointmentDto.limit,
      );
    }

    this.logger.info(
      `CustomerJourneyService : Exit findCompletedAppointments Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit findCompletedAppointments Method`,
    );
    return { appointments, totalCount };
  }

  public generateAppointmentUniqId(store_name: string) {
    this.logger.info(
      `CustomerJourneyService : Enter generateAppointmentUniqId Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter generateAppointmentUniqId Method`,
    );
    let str = store_name;
    str = str.trim();
    let result = '';
    if (str.indexOf(' ') >= 0) {
      if (str.indexOf('-') >= 0) {
        var actual_string = str.split(' ');
        const indexesValue = [];
        actual_string.forEach(async (item, i) => {
          if (item.indexOf('-') > -1) {
            var actual_string = item.split('-');
            const finalStr = this.modifyAppointmentString(actual_string);
            indexesValue.push(finalStr);
          } else {
            var actual_string = item.split(' ');
            const finalStr = this.modifyAppointmentString(actual_string);
            indexesValue.push(finalStr);
          }
        });

        const value = [];
        indexesValue
          .join('-')
          .split('-')
          .forEach((ele) => {
            if (ele) {
              value.push(ele);
            }
          });
        // delete value[value.length -1 ]
        result = value.join('-').toLowerCase();
      } else {
        var actual_string = str.split(' ');
        result = this.modifyAppointmentString(actual_string).toLowerCase();
      }
    } else {
      var actual_string = str.split('-');
      result = this.modifyAppointmentString(actual_string).toLowerCase();
    }
    const storeSlug = result;

    const timestamp = new Date().getTime().toString();
    const last8Digit = timestamp.substring(
      timestamp.length - 6,
      timestamp.length,
    );
    const uniqId =
      storeSlug + '/' + (+last8Digit + Math.ceil(Math.random() * 1000));

    this.logger.info(
      `CustomerJourneyService : Exit generateAppointmentUniqId Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit generateAppointmentUniqId Method`,
    );
    return uniqId.toLocaleLowerCase();
  }

  async appointmentUpdate(
    updateAppointmentDto: UpdateAppointment,
    tenant_id: string,
    domain_name: string,
  ) {
    try {
      this.logger.info(
        `CustomerJourneyService : Enter appointmentUpdate Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Enter appointmentUpdate Method`,
      );

      let [appointmentData] = await this.appointmentRepository.find({
        relations: ['service_booked'],
        where: {
          id: updateAppointmentDto.appointment_id,
        },
      });

      /*const todayDate = new Date();
      if (todayDate > new Date(appointmentData?.appointment_time)) {
        throw new Error('Only upcoming appointments can be updated.');
      }*/

      if (appointmentData) {
        if (
          updateAppointmentDto.type === 'checkin' ||
          updateAppointmentDto.type === 'checkout'
        ) {
          const store_id = appointmentData?.service_booked[0].store_id;

          const store_current_date = await this.getCurrentDateTimeOfStore(
            store_id,
            null,
          );

          const startDate = moment(store_current_date).format(
            Constant.DATE_FORMAT.YMD_HMD_START,
          );
          const endDate = moment(store_current_date).format(
            Constant.DATE_FORMAT.YMD_HMD_END,
          );

          // const startDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_START);
          // const endDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_END);

          const appointment_date = new Date(appointmentData?.appointment_time);
          if (
            appointment_date < new Date(startDate) ||
            appointment_date > new Date(endDate)
          ) {
            throw new Error("You can only modify today's appointment");
          }
        }

        if (updateAppointmentDto.type === 'checkin') {
          const store_id = appointmentData?.service_booked[0].store_id;

          const store_current_date = await this.getCurrentDateTimeOfStore(
            store_id,
            null,
          );
          // GET time limit from franchisor config
          // TODO:: Using franchasior config table directly
          // const [configObj] = await this.franchisorConfigRepository.find({
          //   where: {
          //     category: 'appointment_service_config',
          //     tenant_id,
          //   },
          // });

          const startTimeRage = new Date(
            new Date(appointmentData.appointment_time).setHours(0, 0, 0, 0),
          );

          // AMP-7964
          const endTimeRange = new Date(
            new Date(appointmentData.appointment_time).setHours(23, 59, 59, 59),
          );
          // const minutesToAdd =
          //   +configObj.value['checkin_time_limit'] ||
          //   +Constant.checkout_time_minutes;
          // const endTimeRange = new Date(
          //   moment(appointmentData.appointment_time)
          //     .add(minutesToAdd, 'minutes')
          //     .format('YYYY-MM-DDTHH:mm:59'),
          // );

          // const dateDiff = Math.abs(
          //   new Date(appointmentData.appointment_time).getTime() -
          //     new Date(this.removeTimeZone(store_current_date)).getTime(),
          // );
          // const minutes = Math.round(dateDiff / 60000);

          if (
            new Date(store_current_date) < startTimeRage ||
            new Date(store_current_date) > endTimeRange
          ) {
            throw new Error(
              `This appointment can not be checked-in, because set time limit for past appointment check-in is expired.`,
            );
          }

          await this.appointmentRepository.update(
            {
              id: updateAppointmentDto.appointment_id,
            },
            {
              checkin_time: new Date(),
              status: 'checked_in',
            },
          );

          // send notification to cutter
          if (appointmentData?.client_id) {
            const userData = await this.customerUserRepository.query(
              `SELECT * FROM public.customer_user where id = '${appointmentData.client_id}'`,
            );

            const [appointmentService] =
              await this.appointmentServiceRepository.find({
                where: {
                  appointment_id: updateAppointmentDto.appointment_id,
                },
              });

            if (userData && appointmentService) {
              // get category id from notification_category table
              const [notificationCategory] =
                await this.notificationCategoryRepository.find({
                  where: {
                    category: 'APPOINTMENT_CHECK_IN',
                  },
                });

              const [cutterData] = await this.serviceViewRepository.query(
                `SELECT * FROM public.mv_cutter_schedule where employee_user_id = '${appointmentService.cutter_id}'`,
              );

              // const [storeData] = await this.storeDetailRepository.query(
              //   `SELECT * FROM public.mv_stores where id = '${appointmentService.store_id}'`,
              // );

              // TODO :: to send email to cutter what data i need to pass.
              // TODO:: Need to add service id in the message.
              const notificationObj: any = {
                tenant_id: tenant_id,
                category_id: notificationCategory.id,
                user_type: 'employee',
                notification_type: null,
                title: `Customer Checked in`,
                message_id: updateAppointmentDto.appointment_id,
                message: `Customer checked in for an appointment`,
                schedule_time: new Date(appointmentService.exp_start_date),
                receiver_id: cutterData.employee_user_id,
                expiry_date: new Date(appointmentService.exp_end_date),
                created_by: cutterData.employee_user_id,
              };
              this.logger.info(
                `AppointmentsService : appointmentUpdate : notificationObj : ${JSON.stringify(
                  notificationObj,
                )}`,
              );
              // publish message to rabbitmq
              /*await this.rabbitMQService.emitMqMessages(
                'save_notification',
                notificationObj,
              );*/
            }
          }
        }

        if (updateAppointmentDto.type === 'checkout') {
          await this.appointmentRepository.update(
            {
              id: updateAppointmentDto.appointment_id,
            },
            {
              checkout_time: new Date(),
              status: 'checked_out',
            },
          );
        }

        if (updateAppointmentDto.type === 'cancel') {
          const currentDateTimeOfStoreTimezone = new Date(
            await this.getCurrentDateTimeOfStore(
              null,
              appointmentData.store_timezone
                ? appointmentData.store_timezone
                : 'UTC',
            ),
          );

          const configObj = await this.franchisorConfigRepository.findOne({
            where: {
              category: 'customer_config',
              tenant_id: appointmentData.tenant_id,
            },
          });

          const next24HoursDateTime = currentDateTimeOfStoreTimezone.setDate(
            currentDateTimeOfStoreTimezone.getDate() +
              (configObj
                ? Math.floor(
                    +configObj.value['cancel_appointment_time_limit'] / 24,
                  )
                : 1),
          );

          if (
            new Date(appointmentData.appointment_time) >
            new Date(next24HoursDateTime)
          ) {
            if (Boolean(appointmentData.is_cancelled) === true) {
              throw new Error('This appointment is already canceled.');
            }

            appointmentData = await this.findOneAppointment(
              appointmentData.id,
              domain_name,
              null,
              tenant_id,
            );

            if (updateAppointmentDto.need_to_cancel) {
              await this.appointmentRepository.update(
                {
                  id: updateAppointmentDto.appointment_id,
                },
                {
                  cancellation_reason: updateAppointmentDto.cancellation_reason,
                  status: 'completed',
                  is_cancelled: 1,
                },
              );
            }
          } else {
            const err = new Error(
              `As per terms and conditions you can't cancel the appointments within ${
                configObj
                  ? +configObj.value['cancel_appointment_time_limit']
                  : 24
              } hrs of service. Please contact our executive for queries and cancelation.`,
            );
            err['error_type'] = 'non_cancelable';
            throw err;
          }
        }

        if (updateAppointmentDto.type === 'edit') {
          const key = Constant.REDIS.userCartKey + appointmentData.client_id;
          const getExistingData = await this.redisService.get(key);

          if (!getExistingData || getExistingData?.length === 0) {
            throw new Error(Language.ERROR.ERR_CART_NOT_FOUND);
          }
          // add time_from and time_to in the existingData
          /*getExistingData.forEach(function (existingData, i) {
            existingData.cutter_id = updateAppointmentDto.cutter_id;
            if (existingData.approx_time) {
              if (i >= 1) {
                existingData.time_from = getExistingData[i - 1].time_to;
                existingData.time_to = new Date(
                  getExistingData[i - 1].time_to.getTime() +
                    existingData.approx_time * 60000,
                );
              } else {
                existingData.time_from = new Date(
                  updateAppointmentDto.time_from,
                );
                existingData.time_to = new Date(
                  new Date(updateAppointmentDto.time_from).getTime() +
                    existingData.approx_time * 60000,
                );
              }
            } else {
              existingData.time_from = new Date(updateAppointmentDto.time_from);
              existingData.time_to = new Date(updateAppointmentDto.time_to);
            }
          });*/

          getExistingData.sort(function (x, y) {
            if (new Date(x.time_from) > new Date(y.time_from)) {
              return 1;
            }
            if (new Date(x.time_from) < new Date(y.time_from)) {
              return -1;
            }
            return 0;
          });

          const appointmentObj = {};
          let firstIndex = 0;

          getExistingData.reduce((acc, obj, index) => {
            const found = acc.findIndex(
              (ac) =>
                new Date(ac.time_to).getTime() ===
                  new Date(obj.time_from).getTime() ||
                (new Date(obj.time_from) >= new Date(ac.time_from) &&
                  new Date(obj.time_to) <= new Date(ac.time_to) &&
                  obj.guest_name),
            );
            if (found != -1) {
              acc.push(obj);
              appointmentObj[firstIndex].push(getExistingData[index]);
              return acc;
            } else {
              acc.push(obj);
              appointmentObj[index] = [getExistingData[index]];
              firstIndex = index;
              return acc;
            }
          }, []);

          const totalAppointments: any = Object.values(appointmentObj);
          if (totalAppointments && totalAppointments.length) {
            for (const currentAppointmentArr of totalAppointments) {
              // Update appointment obj
              appointmentData.discount = currentAppointmentArr[0].discount || 0;
              appointmentData.appointment_time = new Date(
                currentAppointmentArr[0].time_from,
              );
              appointmentData.appointment_end_time = new Date(
                currentAppointmentArr[currentAppointmentArr.length - 1].time_to,
              );

              const total_price = currentAppointmentArr.reduce((acc, obj) => {
                const service_option_price =
                  parseFloat(obj.service_option_price) || 0;

                if (parseFloat(obj.discounted_price)) {
                  return (
                    acc +
                    parseFloat(obj.discounted_price) +
                    service_option_price
                  );
                } else {
                  return acc + parseFloat(obj.price) + service_option_price;
                }
              }, 0);

              appointmentData.total_price = total_price;

              await this.appointmentRepository.update(
                {
                  id: appointmentData.id,
                },
                {
                  discount: currentAppointmentArr[0].discount || 0,
                  appointment_time: new Date(
                    currentAppointmentArr[0].time_from,
                  ),
                  appointment_end_time: new Date(
                    currentAppointmentArr[
                      currentAppointmentArr.length - 1
                    ].time_to,
                  ),
                  total_price: total_price,
                  status: 'rescheduled',
                },
              );

              // Delete old appointment service
              await this.appointmentServiceRepository.delete({
                appointment_id: appointmentData.id,
              });

              for (const service of currentAppointmentArr) {
                // Create obj to save appointment service
                const appointmentServiceObj: any = {
                  tenant_id: appointmentData.tenant_id,
                  cutter_id: service.cutter_id,
                  store_id: service.store_id,
                  price: +service.price,
                  tax: 0,
                  discount: service.discount || null,
                  exp_start_date: moment(service.time_from).format(
                    Constant.DATE_FORMAT.YMD_HMD,
                  ),
                  exp_end_date: moment(service.time_to).format(
                    Constant.DATE_FORMAT.YMD_HMD,
                  ),
                  created_by: appointmentData.client_id,
                  appointment_id: appointmentData.id,
                  guest_name: service.guest_name || null,
                  guest_user_id: service.guest_id || null,
                  package_id: service.package_id || null,
                  service_option_id: service.service_option_id || null,
                  cutter_note: service.cutter_note || null,
                  service_option_name: service.service_option_name || null,
                  service_option_price: service.service_option_price || null,
                  service_option_duration:
                    service.service_option_duration || null,
                  is_cutter_assigned: +service.is_cutter_assigned || 0,
                  service_or_package_name: service?.name || '',
                  approx_time: service?.approx_time || 0,
                };

                if (service.package_id) {
                  for (let i = 0; i < service.service_id.length; i++) {
                    appointmentServiceObj['service_id'] =
                      service.service_id[i].id;
                    appointmentServiceObj['service_price'] =
                      service.service_id[i].price;
                    appointmentServiceObj['service_discount'] =
                      service.service_id[i]?.discount || 0;
                    appointmentServiceObj['service_discounted_price'] =
                      service.service_id[i]?.discounted_price || 0;
                    appointmentServiceObj['service_name'] =
                      service.service_id[i]?.name || '';
                    await this.appointmentServiceRepository.save(
                      AppointmentServiceDto.toEntity(appointmentServiceObj),
                    );
                  }
                } else {
                  appointmentServiceObj['service_id'] = service.service_id;
                  await this.appointmentServiceRepository.save(
                    appointmentServiceObj,
                  );
                }
              }
            }
          }

          // remove key from redis
          this.redisService.del(key);
        }

        // AMP-7966
        if (updateAppointmentDto.type === 'rollback') {
          await this.appointmentRepository.update(
            {
              id: updateAppointmentDto.appointment_id,
            },
            {
              checkout_time: null,
              status: 'ongoing',
            },
          );
        }

        this.logger.info(
          `CustomerJourneyService : Exit appointmentUpdate Method`,
        );
        this.ECSlogger.info(
          `CustomerJourneyService : Exit appointmentUpdate Method`,
        );
        return appointmentData;
      } else {
        throw new Error('Appointment not found');
      }
    } catch (error) {
      this.logger.error(
        `CustomerJourneyService : ERROR in catch block CustomerJourneyService Method`,
      );
      this.ECSlogger.error(
        `CustomerJourneyService : ERROR in catch block CustomerJourneyService Method`,
      );
      throw error;
    }
  }

  async findOneAppointment(
    id: string,
    domain_name: string,
    appointment_service_id: string,
    tenant_id: string,
  ): Promise<Appointment> {
    this.logger.info(`AppointmentsService : Enter findOneAppointment Method`);
    this.ECSlogger.info(
      `AppointmentsService : Enter findOneAppointment Method`,
    );

    let appointment = await this.appointmentRepository.findOne({
      relations: ['service_booked'],
      where: { id: id },
    });

    [appointment] = await this.getAppoinmentServiceDetail(
      [appointment],
      tenant_id,
    );

    this.logger.info(`AppointmentsService : Exit findOneAppointment Method`);
    this.ECSlogger.info(`AppointmentsService : Exit findOneAppointment Method`);
    if (appointment) {
      let storeFound = false;
      let storeObj = null;

      if (!storeFound && appointment.service_booked.length) {
        const [storeData] = await this.storeDetailRepository.query(
          `SELECT * FROM public.mv_stores where id = '${appointment.service_booked[0].store_id}'`,
        );

        if (storeData) {
          storeObj = storeData;
          storeFound = true;
        }
      }

      const completedService = appointment.service_booked.filter(
        (ap) => ap.actual_end_time,
      );

      appointment['display_checkout'] =
        appointment.service_booked.length === completedService.length
          ? true
          : false;

      if (appointment_service_id) {
        const new_service_booked = [];

        for (const app_service of appointment.service_booked) {
          if (app_service.package_id) {
            const found = app_service['package_services'].find(
              (aps) => aps.appointment_service_id === appointment_service_id,
            );
            if (found) {
              new_service_booked.push(app_service);
            }
          } else {
            if (app_service.id === appointment_service_id) {
              new_service_booked.push(app_service);
            }
          }

          // get guest name
          if (!app_service.guest_name && app_service.guest_user_id) {
            app_service.guest_name = await this.getGuestName(
              app_service.guest_user_id,
            );
          }
        }
        appointment.service_booked = new_service_booked;
      }

      // calculate cancellation charge based on formula : AMP-2782
      appointment['new_cancellation_charge'] =
        +(
          (appointment?.total_price * appointment.cancellation_charge) /
          100
        ).toFixed(2) || 0;
      if (+storeObj?.tax_rate) {
        appointment['vat_tax'] = appointment['new_cancellation_charge']
          ? +(
              (appointment['new_cancellation_charge'] * +storeObj.tax_rate) /
              100
            ).toFixed(2)
          : 0;
      } else {
        appointment['vat_tax'] = 0;
      }

      appointment['grand_total'] =
        appointment['new_cancellation_charge'] + appointment['vat_tax'];
      return appointment;
    }
    throw new HttpException('Appointment not found', HttpStatus.NOT_FOUND);
  }

  private async getCurrentDateTimeOfStore(store_id, timezone) {
    this.logger.info(
      `CustomerJourneyService : Enter getCurrentDateTimeOfStore Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter getCurrentDateTimeOfStore Method`,
    );
    if (store_id) {
      // find store Details
      const [storeData] = await this.storeDetailRepository.query(`
        SELECT * FROM public.mv_stores where id = '${store_id}'
      `);

      const tzOffset = Constant.timezones[storeData?.timezone] || 'UTC';
      const storeCurrentDate = moment()
        .tz(tzOffset)
        .format('YYYY-MM-DDTHH:mm:ss');

      this.logger.info(
        `CustomerJourneyService : Exit getCurrentDateTimeOfStore Method`,
      );
      this.ECSlogger.info(
        `CustomerJourneyService : Exit getCurrentDateTimeOfStore Method`,
      );
      return storeCurrentDate;
    }

    if (timezone) {
      const storeCurrentDate = moment()
        .tz(Constant.timezones[timezone])
        .format('YYYY-MM-DDTHH:mm:ss');

      return storeCurrentDate;
    }
  }

  private async getAppoinmentServiceDetail(
    appointments,
    tenant_id,
    cutterId: any = null,
  ) {
    this.logger.info(
      `CustomerJourneyService : Enter getAppoinmentServiceDetail Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter getAppoinmentServiceDetail Method`,
    );
    const packages = {};

    const configObj = await this.getFranchisorConfig(tenant_id);

    if (appointments && appointments.length) {
      for (const appointment of appointments) {
        appointment['appointment_time'] = this.removeTimeZone(
          appointment['appointment_time'],
        );
        appointment['appointment_end_time'] = this.removeTimeZone(
          appointment['appointment_end_time'],
        );

        const invoiceDetails = await this.getInvoiceDetails(appointment.id);

        appointment['invoice_id'] = invoiceDetails['invoice_id'];
        appointment['invoice_status'] = invoiceDetails['invoice_status'];
        appointment['payment_status'] = invoiceDetails['payment_status'];
        // appointment['checkin_time'] = appointment['checkin_time']
        //   ? this.removeTimeZone(appointment['checkin_time'])
        //   : appointment['checkin_time'];

        // appointment['checkout_time'] = appointment['checkout_time']
        //   ? this.removeTimeZone(appointment['checkout_time'])
        //   : appointment['checkout_time'];

        appointment['appointment_uniq_id'] =
          appointment['appointment_uniq_id'] || 'AR08072101';
        // TODO:: Make below parameters dynamic in future
        appointment['service_rating'] = '4.2';
        appointment['service_rating_text'] = 'rate text';
        appointment['service_tip'] = 10;

        // assign customer name and profile
        if (appointment?.client_id) {
          const [userData] = await this.customerUserRepository.find({
            where: {
              id: appointment?.client_id,
            },
          });
          if (userData && userData?.fullname) {
            appointment['customer_name'] = `${userData?.fullname}`;
          } else {
            appointment['customer_name'] = '';
          }

          appointment['customer_dob'] = userData?.dob;

          // assign flag to identify new customer or not
          const userFirstAppointment = await this.appointmentRepository.findOne(
            {
              where: {
                client_id: appointment.client_id,
              },
              order: {
                created_at: 'ASC',
              },
            },
          );
          appointment['is_new_user'] =
            userFirstAppointment && userFirstAppointment.id === appointment.id
              ? true
              : false;
          if (userData?.profile_image_url) {
            appointment['customer_profile'] = userData?.profile_image_url;
          } else {
            appointment['customer_profile'] =
              configObj['default_customer_image'];
          }
        }

        // get guest user name which has booked appointment from kiosk
        if (!appointment?.client_id && appointment.guest_user_id) {
          const guest_user_name = await this.getGuestName(
            appointment.guest_user_id,
          );
          if (guest_user_name) {
            appointment['customer_name'] = guest_user_name;
            appointment['client_id'] = appointment.guest_user_id;
          }
        }
        if (appointment.service_booked && appointment.service_booked.length) {
          // get ids of stores and get detail in single query
          const store_ids = appointment.service_booked.map((as) => {
            if (as.store_id) {
              return as.store_id;
            }
          });

          const allStoreData = await this.storeDetailRepository.query(
            `SELECT * FROM public.mv_stores where id IN ('${store_ids.join(
              "', '",
            )}')`,
          );

          for (const service of appointment.service_booked) {
            // get service data
            let where = '';
            if (service.service_id) {
              where = `service_id = '${service.service_id}'`;
            }
            if (service.package_id) {
              where = `service_id = '${service.package_id}'`;
            }

            //HERE
            const [serviceData] = await this.serviceViewRepository.query(
              `SELECT * FROM public.mv_services where ${where}`,
            );

            // update date format
            service['exp_start_date'] = this.removeTimeZone(
              service['exp_start_date'],
            );
            service['exp_end_date'] = this.removeTimeZone(
              service['exp_end_date'],
            );

            // service['actual_start_time'] = service['actual_start_time']
            //   ? this.removeTimeZone(service['actual_start_time'])
            //   : service['actual_start_time'];

            // service['actual_end_time'] = service['actual_end_time']
            //   ? this.removeTimeZone(service['actual_end_time'])
            //   : service['actual_end_time'];

            // HERE
            const storeData = allStoreData.find(
              (s) => s.id === service.store_id,
            );

            appointment['store_id'] = service.store_id;
            appointment['store_name'] = storeData.name;
            appointment['geo_lat'] = storeData.geo_lat;
            appointment['geo_long'] = storeData.geo_long;
            appointment['store_open_time'] = storeData.store_open_time;
            appointment['store_end_time'] = storeData.store_end_time;
            appointment['store_country'] = storeData.country;
            appointment['store_city'] = storeData.city;
            appointment['store_address'] = storeData.address;
            appointment['store_street_name'] = storeData.street_name;
            appointment['store_zipcode'] = storeData.zipcode;
            appointment['store_timezone_name'] = storeData.timezone;
            appointment['store_timezone'] =
              Constant.static_timezone_pair[storeData.timezone.toUpperCase()];
            appointment['store_status'] = storeData.status;

            if (serviceData) {
              let presigned_url = '';
              if (serviceData.service_image_url) {
                presigned_url = serviceData.service_image_url;
              } else {
                presigned_url = configObj['default_service_image'];
              }
              service['name'] =
                service.service_or_package_name || serviceData.service_name;
              service['store_open_time'] = storeData?.store_open_time;
              service['store_end_time'] = storeData?.store_end_time;
              service['status'] = serviceData.status;
              service['store_timezone_name'] = storeData?.timezone;
              service['store_timezone'] =
                Constant.static_timezone_pair[storeData.timezone.toUpperCase()];
              service['store_status'] = storeData.status;

              if (service.discount || service.discount == 0) {
                service['discounted_price'] = +service.discount
                  ? +(
                      service.price -
                      (service.price * +service.discount) / 100
                    ).toFixed(2)
                  : service.price;
              } else {
                service['discounted_price'] = service.price || 0;
              }

              // service['price'] = serviceData.price;
              // service['approx_time'] = serviceData.approx_time
              //   ? +(serviceData.approx_time.split(':')[0] * 60) +
              //     +serviceData.approx_time.split(':')[1]
              //   : 0;
              service['approx_time'] = service.approx_time || 0;
              service['presigned_url'] = presigned_url;
              // service['service_option_id'] = serviceData.svc_option_id;
              service['store_name'] = storeData.name;

              // get add on data if applied
              if (service?.service_option_id) {
                const [serviceOptionData] = await this.serviceViewRepository
                  .query(`
                  SELECT * FROM public.mv_services where svc_option_id = '${service.service_option_id}'
                `);
                service['service_option_id'] = service.service_option_id;
                service['service_option_name'] =
                  service['service_option_name'] || '';
                service['service_option_price'] =
                  service['service_option_price'] || 0;
                if (serviceOptionData) {
                  service['service_option_status'] = 'active';
                } else {
                  service['service_option_status'] = 'deleted';
                }
              }
              (service['geo_lat'] = storeData ? storeData.geo_lat : ''),
                (service['geo_long'] = storeData ? storeData.geo_long : '');
            }

            // get Cutter's data
            if (service.cutter_id) {
              const [cutterData] = await this.serviceViewRepository.query(
                `SELECT * FROM public.mv_cutter_schedule where employee_user_id = '${service.cutter_id}'`,
              );
              if (cutterData) {
                service[
                  'cutter_name'
                ] = `${cutterData?.firstname} ${cutterData?.lastname}`;

                service['cutter_status'] = cutterData?.status;
                if (cutterData.image) {
                  service['cutter_presigned_url'] = cutterData.image;
                } else {
                  service['cutter_presigned_url'] =
                    configObj['default_cutter_image'];
                }
              }
            }

            if (service.package_id) {
              if (
                packages[`${service.package_id}_${service.exp_start_date}`] &&
                packages[`${service.package_id}_${service.exp_start_date}`]
                  .length
              ) {
                packages[
                  `${service.package_id}_${service.exp_start_date}`
                ].push({
                  appointment_service_id: service.id,
                  name: service.service_name || service.name,
                  id: service.service_id,
                  presigned_url: service.presigned_url,
                  service_price: service.service_price,
                  discount: service.service_discount,
                  discounted_price: service.service_discounted_price,
                });
                // appointment.service_booked.splice(index, 1);
              } else {
                packages[`${service.package_id}_${service.exp_start_date}`] = [
                  {
                    appointment_service_id: service.id,
                    name: service.service_name || service.name,
                    id: service.service_id,
                    presigned_url: service.presigned_url,
                    service_price: service.service_price,
                    discount: service.service_discount,
                    discounted_price: service.service_discounted_price,
                  },
                ];
              }
            }

            if (service.package_id) {
              const [package_data] = await this.serviceViewRepository.query(
                `SELECT * FROM public.mv_services where package_id = '${service.package_id}'`,
              );
              if (package_data) {
                service.name = package_data.service_name;
                service.approx_time = package_data.approx_time
                  ? +(package_data.approx_time.split(':')[0] * 60) +
                    +package_data.approx_time.split(':')[1]
                  : 0;
              }
              service['package_services'] =
                packages[`${service.package_id}_${service.exp_start_date}`];
              service['service_id'] = null;
            }
          }
        }

        // const new_appointment = appointment.service_booked.reduce(
        //   (acc, obj) => {
        //     if (obj.package_id) {
        //       const found = acc.find((s) => s.package_id === obj.package_id);
        //       if (!found) {
        //         acc.push(obj);
        //         return acc;
        //       }
        //       return acc;
        //     } else {
        //       acc.push(obj);
        //       return acc;
        //     }
        //   },
        //   [],
        // );
        const new_appointment = [];

        for (const obj of appointment.service_booked) {
          if (obj.package_id) {
            const found = new_appointment.find(
              (app) =>
                app.package_id === obj.package_id &&
                app.exp_start_date === obj.exp_start_date,
            );
            if (!found) {
              new_appointment.push(obj);
            }
          } else {
            new_appointment.push(obj);
          }
        }

        new_appointment.sort(function (x, y) {
          if (new Date(x.appointment_time) > new Date(y.appointment_time)) {
            return 1;
          }
          if (new Date(x.appointment_time) < new Date(y.appointment_time)) {
            return -1;
          }
          return 0;
        });

        appointment.service_booked = new_appointment;

        if (cutterId) {
          appointment.service_booked = appointment.service_booked.filter(
            (sb) => sb.cutterId === cutterId,
          );
        }
      }
    }

    appointments = appointments.filter((a) => {
      return a.service_booked && a.service_booked.length > 0;
    });
    this.logger.info(
      `CustomerJourneyService : Exit getAppoinmentServiceDetail Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit getAppoinmentServiceDetail Method`,
    );
    return appointments;
  }

  private async getInvoiceDetails(appointment_id: string) {
    this.logger.info(`CustomerJourneyService : Enter getInvoiceDetails Method`);
    this.ECSlogger.info(
      `CustomerJourneyService : Enter getInvoiceDetails Method`,
    );
    const response = {
      invoice_id: '',
      invoice_status: '',
      payment_status: '',
    };

    const query = `SELECT * FROM public.mv_appointments where appointment_id = '${appointment_id}'`;
    const data = await this.appointmentViewRepository.query(query);

    if (data?.length) {
      response['invoice_id'] = data[0].invoice_id;
      response['invoice_status'] = data[0].invoice_status;
      response['payment_status'] = data[0].payment_status;
    }
    this.logger.info(`CustomerJourneyService : Exit getInvoiceDetails Method`);
    this.ECSlogger.info(
      `CustomerJourneyService : Exit getInvoiceDetails Method`,
    );
    return response;
  }

  public removeTimeZone(date) {
    const dateValue = new Date(date).valueOf();
    return new Date(dateValue).toISOString().split('.')[0];
  }

  async getGuestName(user_id: string) {
    this.logger.info(`CustomerJourneyService : Enter getGuestName Method`);
    this.ECSlogger.info(`CustomerJourneyService : Enter getGuestName Method`);
    const [userData] = await this.customerGuestUserRepository.find({
      where: {
        id: user_id,
      },
    });
    this.logger.info(`CustomerJourneyService : Exit getGuestName Method`);
    this.ECSlogger.info(`CustomerJourneyService : Exit getGuestName Method`);
    if (userData) {
      return userData.name;
    }
  }

  private async filterAppointmentsBasedOnTimeZone(appointments, type) {
    this.logger.info(
      `CustomerJourneyService : Enter filterAppointmentsBasedOnTimeZone Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter filterAppointmentsBasedOnTimeZone Method`,
    );
    const newAppointments = [];
    if (appointments?.length) {
      for (const appointment of appointments) {
        const timezone = appointment?.store_timezone || 'UTC';
        const currentDateOfStore = await this.getCurrentDateTimeOfStore(
          null,
          timezone,
        );
        let condition = false;
        if (type === 'upcoming') {
          condition =
            new Date(appointment.appointment_time) >=
            new Date(currentDateOfStore);
        }
        if (type === 'previous') {
          condition =
            new Date(appointment.appointment_time) <=
            new Date(currentDateOfStore);
        }
        if (condition) {
          newAppointments.push(appointment);
        }
      }
    }
    this.logger.info(
      `CustomerJourneyService : Exit filterAppointmentsBasedOnTimeZone Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit filterAppointmentsBasedOnTimeZone Method`,
    );
    return newAppointments;
  }

  private async getAppoinmentDetails(appointments, tenant_id) {
    this.logger.info(
      `CustomerJourneyService : Enter getAppoinmentDetails Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter getAppoinmentDetails Method`,
    );
    if (appointments && appointments.length) {
      const configObj = await this.getFranchisorConfig(tenant_id);
      const packages = {};
      for (const appointment of appointments) {
        appointment.appointment_time = this.removeTimeZone(
          appointment.appointment_time,
        );
        appointment.appointment_end_time = this.removeTimeZone(
          appointment.appointment_end_time,
        );
        const appointmentData = await this.appointmentViewRepository.findOne({
          appointment_id: appointment.id,
        });
        if (appointmentData) {
          appointment['invoice_details'] = {
            invoice_id: appointmentData.invoice_id
              ? appointmentData.invoice_id
              : null,
            invoice_status: appointmentData.invoice_status
              ? appointmentData.invoice_status
              : null,
            payment_status: appointmentData.payment_status
              ? appointmentData.payment_status
              : null,
          };
        } else {
          appointment['invoice_details'] = {};
        }
        // assign customer name and profile
        if (appointment?.customer_details) {
          if (appointment.customer_details?.profile_image_url) {
            appointment.customer_details.profile_image_url =
              appointment.customer_details.profile_image_url;
          } else {
            appointment.customer_details.profile_image_url =
              configObj['default_customer_image'];
          }
        }

        // get guest user name which has booked appointment from kiosk
        if (appointment.customer_guest_details) {
          appointment['customer_name'] =
            appointment.customer_guest_details.name;
          appointment['client_id'] = appointment.customer_guest_details.id;
        }
        const new_appointment = [];
        if (appointment.service_booked && appointment.service_booked.length) {
          // get ids of stores and get detail in single query
          let store_ids = appointment.service_booked.map((as) => {
            if (as.store_id) {
              return as.store_id;
            }
          });
          store_ids = [...new Set(store_ids)];
          const allStoreData = await this.storeDetailRepository.find({
            where: { id: In(store_ids) },
          });
          for (const service of appointment.service_booked) {
            // update date format
            service.exp_start_date = this.removeTimeZone(
              service.exp_start_date,
            );
            service.exp_end_date = this.removeTimeZone(service.exp_end_date);
            // get store data
            const storeData = allStoreData.find(
              (s) => s.id === service.store_id,
            );
            appointment['store_details'] = {
              store_id: service.store_id,
              store_name: storeData.name,
              geo_lat: storeData.geo_lat,
              geo_long: storeData.geo_long,
              store_open_time: storeData.store_open_time,
              store_end_time: storeData.store_end_time,
              store_country: storeData.country,
              store_city: storeData.city,
              store_address: storeData.address,
              store_street_name: storeData.street_name,
              store_zipcode: storeData.zipcode,
              store_timezone_name: storeData.timezone,
              store_timezone:
                Constant.static_timezone_pair[storeData.timezone.toUpperCase()],
              store_status: storeData.status,
              primary_contact: storeData.primary_contact
                ? storeData.primary_contact
                : '',
            };
            const service_details = {
              name: service.service_or_package_name,
              approx_time: service.approx_time || 0,
            };
            service['store_details'] = {
              store_open_time: storeData?.store_open_time,
              store_end_time: storeData?.store_end_time,
              store_timezone_name: storeData?.timezone,
              store_timezone:
                Constant.static_timezone_pair[storeData.timezone.toUpperCase()],
              primary_contact: storeData.primary_contact
                ? storeData.primary_contact
                : '',
              store_name: storeData.name,
              store_status: storeData.status,
            };
            // get service data
            const serviceData = await this.serviceViewRepository.findOne({
              where: [
                { service_id: service.service_id },
                { service_id: service.package_id },
              ],
            });
            if (serviceData && serviceData.status) {
              service_details['status'] = serviceData.status;
            } else {
              service_details['status'] = null;
            }
            if (serviceData && serviceData.service_image_url) {
              service_details['presigned_url'] = serviceData.service_image_url;
            } else {
              service_details['presigned_url'] =
                configObj['default_service_image'];
            }
            if (service.discount || service.discount == 0) {
              service_details['discounted_price'] = +service.discount
                ? +(
                    service.price -
                    (service.price * +service.discount) / 100
                  ).toFixed(2)
                : service.price;
            } else {
              service_details['discounted_price'] = service.price || 0;
            }
            // get add on data if applied
            if (service?.service_option_id) {
              const serviceOptionData =
                await this.serviceViewRepository.findOne({
                  svc_option_id: service.service_option_id,
                });
              service_details['service_option_name'] =
                service.service_option_name;
              service_details['service_option_price'] =
                service.service_option_price;
              service_details['service_option_status'] = serviceOptionData
                ? 'active'
                : 'deleted';
              service['service_option_status'] = serviceOptionData
                ? 'active'
                : 'deleted';
            } else {
              service_details['service_option_name'] = null;
              service_details['service_option_price'] = null;
              service_details['service_option_status'] = null;
              service['service_option_status'] = null;
            }
            service['store_details']['geo_lat'] = storeData
              ? storeData.geo_lat
              : '';
            service['store_details']['geo_long'] = storeData
              ? storeData.geo_long
              : '';
            // get Cutter's data
            if (service.cutter_id) {
              const cutterData = await this.cutterScheduleRepository.findOne({
                employee_user_id: service.cutter_id,
              });
              if (cutterData) {
                service_details[
                  'cutter_name'
                ] = `${cutterData?.firstname} ${cutterData?.lastname}`;
                service_details['cutter_status'] = cutterData?.status;
                if (cutterData.image) {
                  service_details['cutter_presigned_url'] = cutterData.image;
                } else {
                  service_details['cutter_presigned_url'] =
                    configObj['default_cutter_image'];
                }
              }
            }
            service['service_details'] = service_details;
            if (service.package_id) {
              if (
                packages[`${service.package_id}_${service.exp_start_date}`] &&
                packages[`${service.package_id}_${service.exp_start_date}`]
                  .length
              ) {
                packages[
                  `${service.package_id}_${service.exp_start_date}`
                ].push({
                  appointment_service_id: service.id,
                  name:
                    service.service_name || service['service_details']['name'],
                  id: service.service_id,
                  presigned_url: service['service_details']['presigned_url'],
                  service_price: service.service_price,
                  discount: service.service_discount,
                  discounted_price: service.service_discounted_price,
                });
              } else {
                packages[`${service.package_id}_${service.exp_start_date}`] = [
                  {
                    appointment_service_id: service.id,
                    name:
                      service.service_name ||
                      service['service_details']['name'],
                    id: service.service_id,
                    presigned_url: service['service_details']['presigned_url'],
                    service_price: service.service_price,
                    discount: service.service_discount,
                    discounted_price: service.service_discounted_price,
                  },
                ];
              }
              service['service_details']['name'] =
                service.service_or_package_name;
              const package_data = await this.serviceViewRepository.findOne({
                package_id: service.package_id,
              });
              if (package_data && package_data.status) {
                service['service_details']['status'] = package_data.status;
              } else {
                service['service_details']['status'] = null;
              }
              service['service_details']['package_services'] =
                packages[`${service.package_id}_${service.exp_start_date}`];
              service['service_details']['service_id'] = null;
              const found = new_appointment.find(
                (app) =>
                  app.package_id === service.package_id &&
                  app.service_id !== service.service_id,
              );
              if (!found) {
                // Added for bug AMP-7689
                const image = await this.serviceViewRepository.findOne({
                  service_name: service.service_details.name,
                  store_id: service.store_id,
                });
                service['service_details']['presigned_url'] =
                  image.service_image_url
                    ? image.service_image_url
                    : configObj['default_service_image'];
                new_appointment.push(service);
              }
            } else {
              new_appointment.push(service);
            }
          }
        }
        new_appointment.sort(function (x, y) {
          if (new Date(x.appointment_time) > new Date(y.appointment_time)) {
            return 1;
          }
          if (new Date(x.appointment_time) < new Date(y.appointment_time)) {
            return -1;
          }
          return 0;
        });
        appointment.service_booked = new_appointment;
        appointment['server_time'] = await this.getCurrentDateTimeOfStore(
          null,
          appointment.store_timezone,
        );
      }
    }
    this.logger.info(
      `CustomerJourneyService : Exit getAppoinmentDetails Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit getAppoinmentDetails Method`,
    );
    return appointments;
  }

  async editAppointment(appointmentEditDto: CJAppointmentEditDto) {
    try {
      this.logger.info(`CustomerJourneyService : Enter editAppointment Method`);
      this.ECSlogger.info(
        `CustomerJourneyService : Enter editAppointment Method`,
      );
      const appointment = await this.appointmentRepository.findOne({
        relations: [
          'service_booked',
          'customer_details',
          'customer_guest_details',
        ],
        where: {
          id: appointmentEditDto.appointment_id,
        },
      });
      if (appointment) {
        const configObj = await this.franchisorConfigRepository.find({
          where: {
            category: In(['appointment_service_config', 'customer_config']),
            tenant_id: appointment.tenant_id,
          },
        });

        const customerConfig = configObj.find(
          (c) => c.category === 'customer_config',
        );

        const currentDateTimeOfStoreTimezone = new Date(
          await this.getCurrentDateTimeOfStore(
            null,
            appointment.store_timezone ? appointment.store_timezone : 'UTC',
          ),
        );

        const next24HoursDateTime = currentDateTimeOfStoreTimezone.setDate(
          currentDateTimeOfStoreTimezone.getDate() +
            (customerConfig
              ? Math.floor(
                  +customerConfig.value['edit_appointment_time_limit'] / 24,
                )
              : 1),
        );

        if (
          new Date(appointment.appointment_time) > new Date(next24HoursDateTime)
        ) {
          const id = appointmentEditDto.customer_id;
          const key = Constant.REDIS.userCartKey + id;
          const getExistingData = await this.redisService.get(key);
          if (
            !getExistingData ||
            (appointmentEditDto.error_type === 'clear_cart' && getExistingData)
          ) {
            // remove key from redis
            this.redisService.del(key);

            // delete previous slots keys
            const slotKey =
              Constant.REDIS.editAppointmentSlotKey +
              appointmentEditDto.appointment_id +
              '_*';
            const slotKeys = await this.redisService.keys(slotKey);
            if (slotKeys?.length > 0) {
              // Delete cart data from redis
              this.redisService.del(slotKeys);
            }

            const ttlTime = await this.appointmentService.getTTLTime(
              appointment.tenant_id,
            );
            const addToCart = [];
            // Add expire time with configurable time limit
            const current_time = new Date().getTime();
            const new_time =
              current_time + Constant.REDIS.expireMinutes * 60 * 1000;
            const expire_time = new Date(new_time);

            const appointmentServiceConfig = configObj.find(
              (c) => c.category === 'appointment_service_config',
            );
            const cart_timer_limit = appointmentServiceConfig
              ? +appointmentServiceConfig.value['cart_timer_mins']
              : Constant.REDIS.TTL_IN_MIN;
            const endDate = moment()
              .add(+cart_timer_limit, 'minutes')
              .format(Constant.DATE_FORMAT.YMD_THMD);

            const obj = [];
            for (const service_booked of appointment.service_booked) {
              // Note: get cutter details.
              const cutterData = await this.cutterScheduleRepository.findOne({
                employee_user_id: service_booked.cutter_id,
              });
              const cutter_name = cutterData
                ? cutterData.firstname + ' ' + cutterData.lastname
                : '';
              let cutter_presigned_url;
              if (cutterData.image) {
                cutter_presigned_url = cutterData.image;
              } else {
                cutter_presigned_url = configObj['default_cutter_image'];
              }

              // Note: get store details.
              const storeData = await this.storeDetailRepository.findOne({
                id: service_booked.store_id,
              });

              // Note: get service details.
              const serviceData = await this.serviceViewRepository.findOne({
                service_id: service_booked.service_id,
              });

              const addToCartObj = {
                customer_id: appointment.client_id,
                customer_name:
                  appointment.customer_details &&
                  appointment.customer_details.fullname
                    ? appointment.customer_details.fullname
                    : '',
                guest_name: service_booked.guest_name
                  ? service_booked.guest_name
                  : '',
                guest_id: service_booked.guest_user_id
                  ? service_booked.guest_user_id
                  : '',
                store_id: service_booked.store_id,
                store_name: storeData ? storeData.name : '',
                time_from: this.removeTimeZone(service_booked.exp_start_date),
                time_to: this.removeTimeZone(service_booked.exp_end_date),
                cutter_id: service_booked.cutter_id,
                cutter_name: cutter_name,
                cutter_profile_image: cutter_presigned_url,
                name: service_booked.service_or_package_name
                  ? service_booked.service_or_package_name
                  : serviceData && serviceData.service_name
                  ? serviceData.service_name
                  : '',
                price: service_booked.price,
                approx_time: service_booked.approx_time,
                discount: service_booked.discount,
                discounted_price:
                  service_booked.discount && +service_booked.discount
                    ? +(
                        service_booked.price -
                        (service_booked.price * +service_booked.discount) / 100
                      ).toFixed(2)
                    : service_booked.price,
                service_option_id: service_booked.service_option_id
                  ? service_booked.service_option_id
                  : '',
                service_option_duration: 0,
                service_option_price: service_booked.service_option_price,
                expire_time: expire_time,
                selectedAddOns: '',
                package_id: service_booked.package_id
                  ? service_booked.package_id
                  : '',
                package_name:
                  service_booked.package_id &&
                  service_booked.service_or_package_name
                    ? service_booked.service_or_package_name
                    : '',
                is_quick_book_flow: true,
                tenant_id: appointment.tenant_id,
                guest_user_id: appointment.guest_user_id
                  ? appointment.guest_user_id
                  : '',
                endDate: endDate,
                appointment_id: appointment.id,
                is_edit_appointment: true,
                edit_appointment_time: this.removeTimeZone(
                  appointment.appointment_time,
                ),
                appointment_service_id: service_booked.id,
              };
              const service_options = [];
              if (service_booked.service_option_id) {
                service_options.push({
                  duration: service_booked.service_option_duration,
                  id: service_booked.service_option_id,
                  name: service_booked.service_option_name,
                  price: service_booked.service_option_price,
                });
              }
              addToCartObj['service_options'] = service_options;

              if (service_booked.package_id) {
                const service_id_arr = [];
                for (const booked of appointment.service_booked) {
                  service_id_arr.push({
                    id: booked.id,
                    name: booked.service_name,
                    price: booked.service_price,
                    discounted_price: booked.service_discounted_price,
                  });
                }
                addToCartObj['service_id'] = service_id_arr;
              } else {
                addToCartObj['service_id'] = service_booked.service_id;
              }

              const edit_appointment_item_ids = [];
              for (const booked of appointment.service_booked) {
                edit_appointment_item_ids.push(
                  booked.service_id ? booked.service_id : booked.package_id,
                );
              }
              addToCartObj['edit_appointment_item_ids'] =
                edit_appointment_item_ids;

              const foundCart = addToCart.find(
                (c) => c.package_id === service_booked.package_id,
              );
              if (!foundCart) {
                addToCart.push(addToCartObj);
              }
              if (service_booked.guest_user_id && service_booked.guest_name) {
                const foundGuest = obj.find(
                  (guestObj) =>
                    guestObj.guest_id === service_booked.guest_user_id,
                );
                if (!foundGuest) {
                  obj.push({
                    guest_id: service_booked.guest_user_id,
                    guest_name: service_booked.guest_name,
                  });
                }
              }
            }
            await this.redisService.set(key, addToCart, ttlTime);

            if (obj) {
              const redisGuestKey = Constant.REDIS.userGuestKey + id;
              await this.redisService.set(redisGuestKey, obj);
            }
          } else {
            const err = new Error('Are you want to empty the cart item(s).');
            err['error_type'] = 'clear_cart';
            throw err;
          }
        } else {
          const err = new Error(
            `As per terms and conditions you can't edit the appointments within ${
              customerConfig
                ? +customerConfig.value['edit_appointment_time_limit']
                : 24
            } hrs of service. Please contact our executive for queries and editable.`,
          );
          err['error_type'] = 'not_editable';
          throw err;
        }
      } else {
        throw new NotFoundException(
          `Appointment #${appointmentEditDto.appointment_id} not found.`,
        );
      }
      this.logger.info(`CustomerJourneyService : Exit editAppointment Method`);
      this.ECSlogger.info(
        `CustomerJourneyService : Exit editAppointment Method`,
      );
      return appointment;
    } catch (err) {
      throw err;
    }
  }

  async findConfig(tenant_id: string): Promise<FranchisorConfig[]> {
    this.logger.info(`CustomerJourneyService : Enter findConfig Method`);
    this.ECSlogger.info(`CustomerJourneyService : Enter findConfig Method`);
    const configObj = await this.franchisorConfigRepository.find({ tenant_id });
    this.logger.info(`CustomerJourneyService : Exit findConfig Method`);
    this.ECSlogger.info(`CustomerJourneyService : Exit findConfig Method`);
    return configObj;
  }

  async findConfigForInStore(tenant_id: string): Promise<FranchisorConfig[]> {
    try {
      this.logger.info(`CustomerJourneyService : Enter findConfig Method`);
      this.ECSlogger.info(`CustomerJourneyService : Enter findConfig Method`);
      let configObj = await this.franchisorConfigRepository.find({ tenant_id });
      configObj = configObj.filter((data) => {
        return data.category === 'in_store';
      });
      this.logger.info(`CustomerJourneyService : Exit findConfig Method`);
      this.ECSlogger.info(`CustomerJourneyService : Exit findConfig Method`);
      return configObj;
    } catch (e) {
      throw new Error(Language.ERROR.ERR_TENANT_ID);
    }
  }

  async getServiceDetailsForRebookAdmin(appointmentData: any) {
    this.logger.info(
      `CustomerJourneyService : Enter getServiceDetailsForRebookAdmin Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter getServiceDetailsForRebookAdmin Method`,
    );
    const serviceList = [];
    let index = 0;
    for (const service_booked of appointmentData.service_booked) {
      const serviceData = await this.serviceRepository.findOne({
        relations: ['service_options'],
        where: {
          id: service_booked.service_id,
          status: 'active',
        },
      });
      const duration = await this.utilityService.convertH2M(
        serviceData.approx_time,
      );
      serviceData.approx_time = duration.toString();
      serviceData.duration = duration.toString();
      serviceList.push(serviceData);

      const price = serviceData.price;
      const discount = serviceData.discount / 100;
      const discout_price = price - price * discount;
      serviceList[index]['discounted_price'] = discout_price.toFixed(2);
      index++;
    }
    this.logger.info(
      `CustomerJourneyService : Exit getServiceDetailsForRebookAdmin Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit getServiceDetailsForRebookAdmin Method`,
    );
    return serviceList;
  }

  public modifyAppointmentString(actual_string) {
    let result;
    const sub = [];
    if (actual_string.length == 1) {
      const data = actual_string.join('');
      const parsedData = data.substring(0, 2);
      result = parsedData;
    } else {
      actual_string.forEach((ele) => {
        const arr = ele.split('');
        if (arr.length == 1 || arr.length == 2) {
          const arr1 = arr.join('');
          sub.push(`${arr1}`);
        } else {
          arr.forEach((item, i) => {
            if (i == 0) {
              const temp = arr.join('');
              const parsedData1 = temp.substring(0, 2);
              sub.push(parsedData1);
            }
          });
        }
      });
      result = sub.join('-');
    }
    return result;
  }

  async fetchStores(
    tenant_id: string,
    city: string,
    lat: number,
    long: number,
    start: number,
    limit: number,
  ) {
    try {
      this.logger.info(`CustomerJourneyService : Enter fetchStores Method`);
      this.ECSlogger.info(`CustomerJourneyService : Enter fetchStores Method`);
      const configObj = await this.getFranchisorConfig(tenant_id);
      let totalCount = 0;
      let storesDetails = await this.storeDetailRepository.query(
        `SELECT DISTINCT id,
        name,
        franchisor_name,
        geo_lat,
        geo_long,
        logo,
        description,
        country,
        state,
        city,
        address,
        street_name,
        zipcode,
        status,
        timezone,
        is_deleted FROM mv_stores WHERE city = '${city}'`,
      );
      if (storesDetails) {
        for (const storeDetail of storesDetails) {
          storeDetail['estimated_time_sec'] = 0;
          storeDetail['rating'] = +(Math.random() * 5).toFixed(2);

          // Get store images/logo
          if (storeDetail.logo) {
            storeDetail['presigned_url'] = storeDetail.logo;
          } else {
            storeDetail['presigned_url'] =
              configObj['default_store_image'] || '';
            storeDetail['logo'] = configObj['default_store_image'] || '';
          }
        }

        totalCount = storesDetails.length;

        if (start && limit) {
          storesDetails = storesDetails.slice(
            (start - 1) * limit,
            start * limit,
          );
        }

        storesDetails = storesDetails.sort(function (a, b) {
          const x = a.rating;
          const y = b.rating;
          if (x > y) {
            return -1;
          }
          if (x < y) {
            return 1;
          }
          return 0;
        });
      }
      this.logger.info(`CustomerJourneyService : Exit fetchStores Method`);
      this.ECSlogger.info(`CustomerJourneyService : Exit fetchStores Method`);
      return {
        records: storesDetails,
        totalCount: totalCount,
      };
    } catch (err) {
      throw err;
    }
  }

  private async addEditAppointmentKey(getExistingData, preBookedSlotsIndex) {
    this.logger.info(
      `CustomerJourneyService : Enter addEditAppointmentKey Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter addEditAppointmentKey Method`,
    );
    if (
      getExistingData[preBookedSlotsIndex] &&
      getExistingData[preBookedSlotsIndex]?.is_edit_appointment
    ) {
      // Save removed slot in another key in redis for that cutter only and that appointment only
      const appointment_id =
        getExistingData[preBookedSlotsIndex].appointment_id;
      const cutter_id = getExistingData[preBookedSlotsIndex].cutter_id;
      const objToSave = {
        cutter_id,
        appointment_id,
        appointment_service_id:
          getExistingData[preBookedSlotsIndex].appointment_service_id,
        time_from: getExistingData[preBookedSlotsIndex].time_from,
        time_to: getExistingData[preBookedSlotsIndex].time_to,
        service_or_package_name: getExistingData[preBookedSlotsIndex].name
          ? getExistingData[preBookedSlotsIndex].name
          : getExistingData[preBookedSlotsIndex].service_or_package_name,
        guest_name: getExistingData[preBookedSlotsIndex].guest_name,
      };
      const slotKey =
        Constant.REDIS.editAppointmentSlotKey +
        appointment_id +
        `_${cutter_id}`;
      const existingSlots = await this.redisService.get(slotKey);
      if (existingSlots?.length) {
        existingSlots.push(objToSave);
        await this.redisService.set(slotKey, existingSlots);
      } else {
        await this.redisService.set(slotKey, [objToSave]);
      }
    }
    this.logger.info(
      `CustomerJourneyService :Exit addEditAppointmentKey Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit addEditAppointmentKey Method`,
    );
  }
}
