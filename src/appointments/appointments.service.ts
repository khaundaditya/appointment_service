import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisCacheService } from '../redis/redis.service';
import {
  Between,
  In,
  MoreThanOrEqual,
  LessThanOrEqual,
  Repository,
  MoreThan,
  LessThan,
  Not,
} from 'typeorm';
import { CutterAvailabilityDto } from './dto/cutter-availability.dto';
import { MvCutterSchedule } from './entities/mv-cutter-schedule.view';
import { Constant } from '../common/config/constant';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UtilityService } from '../common/libs/utility.service';
import { MvStores } from './entities/mv-store.view';
import { MvServices } from './entities/mv-service-view.entity';
import { Appointment } from './entities/appointment.entity';
import * as _ from 'lodash';
import { AppointmentBookDto } from './dto/appointment.dto';
import { AppointmentService } from './entities/appointment-service.entity';
import got from 'got';
import { LoggerService } from '../logger/logger.service';
import { AddInstructionDto } from './dto/add-instruction.dto';
import * as moment from 'moment-timezone';
import { AppointmentServiceDto } from './dto/appointment-service.dto';
import * as AWS from 'aws-sdk';
import { AppointmentConfirmDto } from './dto/appointment-confirm.dto';
import { UpdateAppointment } from './dto/update-appointment.dto';
import { UpdateAppointmentService } from './dto/update-service.dto';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { CustomerUser } from '../users/entities/customer-user.entity';
import { WalkOutDto } from './dto/walk-out.dto';
import { CustomerWalkout } from './entities/customer-walkout.entity';
import { NotificationCategory } from './entities/notification-category.entity';
import { NotificationType } from './entities/notification-type.entity';
import { GetServiceDto } from './dto/service-details.dto';
import { FranchisorConfig } from './entities/franchisor-config.entity';
import { Franchisor } from './entities/franchisor.entity';
import { UsersService } from '../users/users.service';
import { CustomerGuestUser } from '../users/entities/customer-guest-user.entity';
import { AddMusicBeveragesDto } from './dto/add-music-beverages.dto';
import { CancelInvoiceRabitMQService } from '../invoice-cancel-rabbitmq/invoice-cancel-rabbitmq.service';
import { MvAppointments } from './entities/mv-appointment.view';
import { CustomerView } from '../users/entities/mv-customer.view';
import { CreateSendMessageDto } from './dto/create-send-message.dto';
import { MvBrands } from './entities/mv-brands.view';
import { AppointmentEditDto } from './dto/edit-appointment.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { ECSLoggerService } from '../logger/ECSlogger.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(MvCutterSchedule)
    private cutterScheduleRepository: Repository<MvCutterSchedule>,
    @InjectRepository(MvStores)
    private storeDetailRepository: Repository<MvStores>,
    @InjectRepository(MvServices)
    private serviceRepository: Repository<MvServices>,
    private redisService: RedisCacheService,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(AppointmentService)
    private appointmentServiceRepository: Repository<AppointmentService>,
    @InjectRepository(CustomerUser)
    private customerUserRepository: Repository<CustomerUser>,
    @InjectRepository(CustomerWalkout)
    private customerWalkoutRepository: Repository<CustomerWalkout>,
    @InjectRepository(NotificationCategory)
    private notificationCategoryRepository: Repository<NotificationCategory>,
    @InjectRepository(NotificationType)
    private notificationTypeRepository: Repository<NotificationType>,
    @InjectRepository(FranchisorConfig)
    private franchisorConfigRepository: Repository<FranchisorConfig>,
    @InjectRepository(Franchisor)
    private franchisorRepository: Repository<Franchisor>,
    @InjectRepository(CustomerGuestUser)
    private customerGuestUserRepository: Repository<CustomerGuestUser>,
    @InjectRepository(MvAppointments)
    private appointmentViewRepository: Repository<MvAppointments>,
    @InjectRepository(CustomerView)
    private customerViewRepository: Repository<CustomerView>,
    @InjectRepository(MvBrands)
    private mvBrandRepository: Repository<MvBrands>,
    private readonly utilityService: UtilityService,
    private readonly loggerService: LoggerService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly usersService: UsersService,
    private readonly cancelInvoiceRabitMQService: CancelInvoiceRabitMQService,
    private readonly ECSloggerService: ECSLoggerService,
    @InjectRepository(MvBrands)
    private brandViewRepository: Repository<MvBrands>,
  ) {
    AWS.config.update({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  public logger = this.loggerService.initiateLogger();
  public ECSlogger = this.loggerService.initiateLogger();

  async checkingCutteravailabilityByCutter(
    cutterAvailabilityDto: CutterAvailabilityDto,
    domain_name: string,
    customer_id: string,
    tenant_id: string,
  ): Promise<CutterAvailabilityDto[]> {
    this.logger.info(
      `AppointmentsService : Enter checkingCutteravailabilityByCutter Method`,
    );
    this.ECSlogger.info(
      `AppointmentsService : Enter checkingCutteravailabilityByCutter Method`,
    );

    let cutters = [];
    const currentDay = new Date(cutterAvailabilityDto.date).getDay();
    const dayName = Constant.WEEK_DAYS[currentDay];

    const [storeData] = await this.storeDetailRepository.query(`
      SELECT * FROM public.mv_stores where id = '${cutterAvailabilityDto.store_id}' AND weekday = '${dayName}'
    `);

    if (!storeData) {
      throw new Error('Store not found.');
    }

    // Note: 1 - pending, 2 - active, 3 - inactive
    if (+storeData?.status === 3) {
      throw new Error('Store is inactive.');
    }

    const configObj = await this.getFranchisorConfig(tenant_id);

    let startDate = `${cutterAvailabilityDto.date} 00:00:00`;
    let endDate = `${cutterAvailabilityDto.date} 23:59:59`;

    if (storeData?.store_open_time && storeData?.store_end_time) {
      const startTime = storeData.store_open_time.split(' ')[0];
      let startHour = startTime.split(':')[0];
      const startMinute = startTime.split(':')[1];
      if (
        storeData.store_open_time.split(' ')[1].toLowerCase() === 'pm' &&
        +startHour !== 12
      ) {
        startHour = +startHour + 12;
      }

      if (
        storeData.store_open_time.split(' ')[1].toLowerCase() === 'am' &&
        +startHour === 12
      ) {
        startHour = '00';
      }
      if (+startHour <= 9) {
        startHour = '0' + +startHour;
      }
      const endTime = storeData.store_end_time.split(' ')[0];
      let endHour = endTime.split(':')[0];
      const endMinute = endTime.split(':')[1];
      if (
        storeData.store_end_time.split(' ')[1].toLowerCase() === 'pm' &&
        +endHour != 12
      ) {
        endHour = +endHour + 12;
      }
      if (+endHour <= 9) {
        endHour = '0' + +endHour;
      }
      if (startHour && startMinute) {
        startDate = `${cutterAvailabilityDto.date}T${startHour}:${startMinute}:00`;
        // startDate = `${cutterAvailabilityDto.date}T00:00:00`;
        // endDate = `${cutterAvailabilityDto.date}T${endHour}:${endMinute}:59`;
        // endDate = `${cutterAvailabilityDto.date}T23:59:59`;
        endDate = `${cutterAvailabilityDto.date}T23:59:59`;
      }
    } else {
      throw new Error('Store is closed for selected date');
    }

    // current date in store's timezone
    const storeTimezone = storeData?.timezone.toUpperCase() || 'UTC';
    const tzOffset = Constant.timezones[storeTimezone];
    const storeCurrentDate = moment()
      .tz(tzOffset)
      .format('YYYY-MM-DDTHH:mm:ss');

    // let cutterSchedules = await this.cutterScheduleRepository.find({
    //   store_id: cutterAvailabilityDto.store_id,
    //   shift_start_time: MoreThanOrEqual(
    //     this.utilityService.getStartOfTheDay(cutterAvailabilityDto.date),
    //   ),
    //   shift_end_time: LessThan(
    //     this.utilityService.getEndOfTheDay(cutterAvailabilityDto.date),
    //   ),
    //   status: 'active',
    // });

    const cutterQuery = `
        SELECT DISTINCT on (employee_user_id, shift_start_time, shift_type)
        * FROM mv_cutter_schedule
        WHERE
                store_id = '${cutterAvailabilityDto.store_id}'
                AND (
                  (shift_start_time >= '${startDate}' AND shift_end_time > '${startDate}')
                  OR
                  ('${startDate}' >= shift_start_time AND '${startDate}' <= shift_end_time)
                ) AND shift_end_time <= '${endDate}' AND status = 'active' AND is_deleted = false 
    `;

    let cutterSchedules = await this.cutterScheduleRepository.query(
      cutterQuery,
    );
    const cutterSchedulesByShift = cutterSchedules.filter(
      (cutterSchedule) => cutterSchedule.shift_type === 'shift',
    );

    const cutterSchedulesByOtherShift = cutterSchedules.filter(
      (cutterSchedule) =>
        cutterSchedule.shift_type === 'time_off' ||
        cutterSchedule.shift_type === 'lunch_break' ||
        cutterSchedule.shift_type === 'training',
    );

    await cutterSchedulesByShift.forEach(
      async (cutterScheduleByShift, index) => {
        const cutterSchedulesByOtherShiftByEmployee =
          cutterSchedulesByOtherShift.filter(
            (cutterScheduleByOtherShift) =>
              cutterScheduleByShift.employee_user_id ===
              cutterScheduleByOtherShift.employee_user_id,
          );
        if (
          cutterSchedulesByOtherShiftByEmployee &&
          cutterSchedulesByOtherShiftByEmployee.length > 0
        ) {
          await cutterSchedulesByOtherShiftByEmployee.forEach(
            async (cutterScheduleByOtherShiftByEmployee) => {
              const mvCutterSchedule = MvCutterSchedule.from(
                cutterScheduleByShift,
              );
              mvCutterSchedule.shift_end_time =
                cutterScheduleByOtherShiftByEmployee.shift_start_time;
              cutterSchedulesByShift.push(mvCutterSchedule);
              cutterScheduleByShift.shift_start_time =
                cutterScheduleByOtherShiftByEmployee.shift_end_time;
            },
          );
          const mvCutterSchedule = MvCutterSchedule.from(cutterScheduleByShift);
          mvCutterSchedule.shift_start_time =
            cutterScheduleByShift.shift_start_time;
          mvCutterSchedule.shift_end_time =
            cutterScheduleByShift.shift_end_time;
          cutterSchedulesByShift.push(mvCutterSchedule);

          cutterSchedulesByShift.splice(index, 1);
        }
      },
    );
    cutterSchedules = cutterSchedulesByShift;

    const specialityObj = cutterSchedules.reduce((acc, obj) => {
      if (acc[obj.employee_id]) {
        if (acc[obj.employee_id].indexOf(obj.speciality) === -1) {
          acc[obj.employee_id].push(obj.speciality);
        }
        return acc;
      } else {
        acc[obj.employee_id] = [obj.speciality];
        return acc;
      }
    }, {});

    if (await this.utilityService.isNotEmptyObject(cutterSchedules)) {
      await cutterSchedules.forEach(async (cutterSchedule) => {
        const existingCutter = cutters?.find(
          (cutter) =>
            cutter.employee_user_id === cutterSchedule.employee_user_id,
        );
        if (!existingCutter) {
          if (specialityObj[cutterSchedule.employee_user_id]) {
            cutterSchedule.speciality =
              specialityObj[cutterSchedule.employee_user_id].join(', ');
          }
          cutterSchedule['cutter_availability'] = [
            {
              shift_start_time: cutterSchedule.shift_start_time,
              shift_end_time: cutterSchedule.shift_end_time,
            },
          ];
          cutters.push(cutterSchedule);
        } else {
          existingCutter.cutter_availability.push({
            shift_start_time: cutterSchedule.shift_start_time,
            shift_end_time: cutterSchedule.shift_end_time,
          });
        }
      });
      const bookedCutters = await this.appointmentServiceRepository.find({
        relations: ['appointment'],
        where: {
          store_id: cutterAvailabilityDto.store_id,
          exp_start_date: MoreThanOrEqual(
            `${cutterAvailabilityDto.date} 00:00:00`,
          ),
          exp_end_date: LessThan(`${cutterAvailabilityDto.date} 23:59:59`),
          appointment: {
            is_cancelled: null,
          },
        },
      });
      const allKey = await this.redisService.keys(
        Constant.REDIS.userCartKey + '*',
      );
      if (await this.utilityService.isNotEmptyObject(allKey)) {
        const cartBookedCutters = await this.redisService.mget(allKey);
        if (await this.utilityService.isNotEmptyObject(cartBookedCutters)) {
          cartBookedCutters.forEach((cartBookedCutter) => {
            cartBookedCutter.forEach((cutter) => {
              if (
                cutter.store_id === cutterAvailabilityDto.store_id &&
                cutter.time_from >= `${cutterAvailabilityDto.date}T00:00:00` &&
                cutter.time_to < `${cutterAvailabilityDto.date}T23:59:59`
              ) {
                bookedCutters.push(cutter);
              }
            });
          });
        }
      }
      for (const cutter of cutters) {
        if (cutter.image) {
          cutter.presigned_url = cutter.image;
        } else {
          cutter.presigned_url = configObj['default_cutter_image'];
        }
        let foundCuttersBookedArray = bookedCutters.filter((bc) => {
          return bc.cutter_id === cutter.employee_user_id;
        });

        // Note: to uncomment for fixed AMP-7723 & AMP-8370
        foundCuttersBookedArray.sort(function (x, y) {
          if (
            new Date(x['time_from'] ? x['time_from'] : x.exp_start_date) >
            new Date(y['time_from'] ? y['time_from'] : y.exp_start_date)
          ) {
            return 1;
          }
          if (
            new Date(x['time_from'] ? x['time_from'] : x.exp_start_date) <
            new Date(y['time_from'] ? y['time_from'] : y.exp_start_date)
          ) {
            return -1;
          }
          return 0;
        });

        // remove service from booked that has same time - 8423
        let existingSlotData = [];
        if (cutterAvailabilityDto.appointment_id) {
          const slotKeys =
            Constant.REDIS.editAppointmentSlotKey +
            cutterAvailabilityDto.appointment_id +
            `_${cutter.employee_user_id}`;
          if (slotKeys?.length) {
            existingSlotData = await this.redisService.get(slotKeys);

            if (existingSlotData?.length) {
              // remove service
              for (const slotObj of existingSlotData) {
                const objIndex = foundCuttersBookedArray.findIndex(
                  (obj) => obj.id == slotObj.appointment_service_id,
                );

                if (objIndex > -1) {
                  foundCuttersBookedArray[objIndex]['removeItem'] = true;
                }
              }
            }
            foundCuttersBookedArray = foundCuttersBookedArray.filter(
              (o) => !o['removeItem'],
            );
          }
        }

        if (foundCuttersBookedArray && foundCuttersBookedArray.length > 0) {
          // foundCuttersBookedArray.map(obj => obj['appointment_service_id'] = obj.id)
          // foundCuttersBookedArray.reduce((acc, obj, index) => {
          //   const found = acc.findIndex(
          //     (ac) => ac.appointment_service_id == obj['appointment_service_id']
          //   );
          //   if (found != -1) {
          //     acc.push(obj);
          //     return acc;
          //   }
          //     return acc;
          // }, []);

          cutter.cutter_availability.forEach((a) => {
            a.shift_start_time = this.removeTimeZone(a.shift_start_time);
            const final_shift_end_time = this.removeTimeZone(a.shift_end_time);
            foundCuttersBookedArray.forEach((b, i) => {
              if (i === 0) {
                a.shift_end_time =
                  b['time_from'] || this.removeTimeZone(b.exp_start_date);
              } else {
                cutter.cutter_availability.push({
                  shift_start_time:
                    foundCuttersBookedArray[i - 1]['time_to'] ||
                    this.removeTimeZone(
                      foundCuttersBookedArray[i - 1].exp_end_date,
                    ),
                  shift_end_time:
                    b['time_from'] || this.removeTimeZone(b.exp_start_date),
                });
              }
            });
            cutter.cutter_availability.push({
              shift_start_time:
                foundCuttersBookedArray[foundCuttersBookedArray.length - 1][
                  'time_to'
                ] ||
                this.removeTimeZone(
                  foundCuttersBookedArray[foundCuttersBookedArray.length - 1]
                    .exp_end_date,
                ),
              shift_end_time: final_shift_end_time,
            });
          });
        }

        cutter.cutter_availability.filter((ca, index) => {
          if (ca.shift_start_time === ca.shift_end_time) {
            cutter.cutter_availability.splice(index, 1);
          }
        });

        cutter.cutter_availability = await this.timeSlots(
          cutterAvailabilityDto.service_duration,
          [],
          cutter.cutter_availability,
          cutterAvailabilityDto.req_type,
          customer_id,
        );

        // add slot which are freed while editing an appointment - 8423
        if (cutterAvailabilityDto?.appointment_id) {
          const slotKeys =
            Constant.REDIS.editAppointmentSlotKey +
            cutterAvailabilityDto.appointment_id +
            `_${cutter.employee_user_id}`;
          if (slotKeys?.length) {
            // const slotsData = await this.redisService.keys(slotKeys);
            // existingSlotData = await this.redisService.get(slotKeys);

            const slotsToInsert = [];
            if (existingSlotData?.length) {
              for (const obj of existingSlotData) {
                const startDate = moment(obj.time_from).format(
                  Constant.DATE_FORMAT.YMD_HMD,
                );
                const endDate = moment(obj.time_to).format(
                  Constant.DATE_FORMAT.YMD_HMD,
                );
                const dateDiff = moment(endDate).diff(startDate, 'minutes');

                if (dateDiff >= cutterAvailabilityDto.service_duration) {
                  if (dateDiff === +cutterAvailabilityDto.service_duration) {
                    // slotsToInsert.push({
                    //   time_from: obj.time_from,
                    //   time_to: obj.time_to,
                    //   service_or_package_name: obj.service_or_package_name,
                    //   guest_name: obj.guest_name,
                    // });
                    let indexToAssign = cutter.cutter_availability.findIndex(
                      (caObj) => {
                        const cond =
                          caObj.time_from.toString() ===
                            obj.time_from.toString() &&
                          caObj.time_to.toString() === obj.time_to.toString();
                        if (cond) return cond;
                      },
                    );

                    const indexToAssign2 = cutter.cutter_availability.findIndex(
                      (caObj) => {
                        // TODO:: check below condition when slots are not generated as same
                        const cond2 =
                          new Date(caObj.time_from) <= new Date(obj.time_to) &&
                          new Date(caObj.time_to) >= new Date(obj.time_from) &&
                          new Date(caObj.time_to) <= new Date(obj.time_to);

                        if (cond2) return cond2;
                      },
                    );

                    if (!indexToAssign) {
                      indexToAssign = indexToAssign2;
                    }

                    if (indexToAssign > -1) {
                      cutter.cutter_availability[indexToAssign][
                        'service_or_package_name'
                      ] = obj.service_or_package_name;
                      cutter.cutter_availability[indexToAssign]['guest_name'] =
                        obj.guest_name;
                    }
                  } else {
                    // calculate new slot based on minutes
                    const newEndDate = moment(obj.time_from)
                      .add(+cutterAvailabilityDto.service_duration, 'minutes')
                      .format(Constant.DATE_FORMAT.YMD_THMD);
                    // slotsToInsert.push({
                    //   time_from: obj.time_from,
                    //   time_to: newEndDate,
                    //   service_or_package_name: obj.service_or_package_name,
                    //   guest_name: obj.guest_name,
                    // });
                    const indexToAssign = cutter.cutter_availability.findIndex(
                      (caObj) => {
                        const cond =
                          caObj.time_from.toString() ===
                            obj.time_from.toString() &&
                          caObj.time_to.toString() === newEndDate.toString();

                        return cond;
                      },
                    );

                    if (indexToAssign > -1) {
                      cutter.cutter_availability[indexToAssign][
                        'service_or_package_name'
                      ] = obj.service_or_package_name;
                      cutter.cutter_availability[indexToAssign]['guest_name'] =
                        obj.guest_name;
                    }
                  }
                } else {
                  // here incoming durating will be greater
                  const indexToAssign = cutter.cutter_availability.findIndex(
                    (caObj) => {
                      const cond =
                        (new Date(caObj.time_from) <= new Date(obj.time_from) &&
                          new Date(caObj.time_to) >= new Date(obj.time_to)) ||
                        (new Date(caObj.time_from) <= new Date(obj.time_to) &&
                          new Date(caObj.time_to) >= new Date(obj.time_from) &&
                          new Date(caObj.time_to) <= new Date(obj.time_to));

                      return cond;
                    },
                  );

                  if (indexToAssign > -1) {
                    cutter.cutter_availability[indexToAssign][
                      'service_or_package_name'
                    ] = obj.service_or_package_name;
                    cutter.cutter_availability[indexToAssign]['guest_name'] =
                      obj.guest_name;
                  }
                }
              }
            }
            cutter.cutter_availability = [
              ...cutter.cutter_availability,
              ...slotsToInsert,
            ];
          }
        }

        cutter.cutter_availability = await this.sortingTimestamp(
          cutter.cutter_availability,
        );

        // cutter.cutter_availability = cutter.cutter_availability.filter((ca) => {
        //   return (
        //     new Date(ca.time_from) >= new Date(startDate) &&
        //     new Date(ca.time_to) <= new Date(endDate) &&
        //     storeCurrentDate &&
        //     new Date(ca.time_from) >= new Date(storeCurrentDate)
        //   );
        // });

        cutter.cutter_availability = cutter.cutter_availability.filter((ca) => {
          return (
            ((new Date(ca.time_from) >= new Date(startDate) &&
              new Date(ca.time_to) <= new Date(endDate)) ||
              ca.service_or_package_name) &&
            storeCurrentDate &&
            (new Date(ca.time_from) >= new Date(storeCurrentDate) ||
              ca.service_or_package_name)
          );
        });

        // assign store_open_time and close time
        cutter.store_open_time = storeData?.store_open_time;
        cutter.store_end_time = storeData?.store_end_time;

        //assign store timezone
        cutter['store_timezone_name'] = storeData?.timezone;
        cutter['store_timezone'] =
          Constant.static_timezone_pair[storeData.timezone.toUpperCase()];

        // calculate rating
        cutter['rating'] = +(Math.random() * 5).toFixed(2);
        cutter['total_number_of_rating'] = 50;
      }
      cutters = cutters.filter((c) => {
        return c.cutter_availability?.length > 0;
      });
    }

    this.logger.info(
      `AppointmentsService : Exit checkingCutteravailabilityByCutter Method`,
    );
    this.ECSlogger.info(
      `AppointmentsService : Exit checkingCutteravailabilityByCutter Method`,
    );
    return cutters;
  }

  async checkingCutteravailabilityBySaloon(
    cutterAvailabilityDto: CutterAvailabilityDto,
  ): Promise<CutterAvailabilityDto[]> {
    this.logger.info(
      `AppointmentsService : Enter checkingCutteravailabilityBySaloon Method`,
    );
    this.ECSlogger.info(
      `AppointmentsService : Enter checkingCutteravailabilityBySaloon Method`,
    );
    let cuttersBySaloon = [];
    const currentDay = new Date(cutterAvailabilityDto.date).getDay();
    const dayName = Constant.WEEK_DAYS[currentDay];

    const [storeData] = await this.storeDetailRepository.query(`
      SELECT * FROM public.mv_stores where id = '${cutterAvailabilityDto.store_id}' AND weekday = '${dayName}'
    `);

    if (!storeData) {
      throw new Error('Store not found.');
    }

    let startDate = `${cutterAvailabilityDto.date} 00:00:00`;
    let endDate = `${cutterAvailabilityDto.date} 23:59:59`;

    if (storeData?.store_open_time && storeData?.store_end_time) {
      const startTime = storeData.store_open_time.split(' ')[0];
      let startHour = startTime.split(':')[0];
      const startMinute = startTime.split(':')[1];
      if (
        storeData.store_open_time.split(' ')[1].toLowerCase() === 'pm' &&
        +startHour !== 12
      ) {
        startHour = +startHour + 12;
      }

      if (
        storeData.store_open_time.split(' ')[1].toLowerCase() === 'am' &&
        +startHour === 12
      ) {
        startHour = '00';
      }
      if (+startHour <= 9) {
        startHour = '0' + +startHour;
      }
      const endTime = storeData.store_end_time.split(' ')[0];
      let endHour = endTime.split(':')[0];
      const endMinute = endTime.split(':')[1];
      if (storeData.store_end_time.split(' ')[1].toLowerCase() === 'pm') {
        endHour = +endHour + 12;
      }
      if (+endHour <= 9) {
        endHour = '0' + +endHour;
      }
      if (startHour && startMinute) {
        // startDate = `${cutterAvailabilityDto.date}T${startHour}:${startMinute}:00`;
        startDate = `${cutterAvailabilityDto.date}T00:00:00`;
        // endDate = `${cutterAvailabilityDto.date}T${endHour}:${endMinute}:59`;
        // endDate = `${cutterAvailabilityDto.date}T23:59:59`;
        endDate = `${cutterAvailabilityDto.date}T23:59:59`;
      }
    } else {
      throw new Error('Store is closed for selected date');
    }

    // current date in store's timezone
    const storeTimezone = storeData?.timezone.toUpperCase() || 'UTC';
    const tzOffset = Constant.timezones[storeTimezone];
    const storeCurrentDate = moment()
      .tz(tzOffset)
      .format('YYYY-MM-DDTHH:mm:ss');

    // let cutterSchedules = await this.cutterScheduleRepository.find({
    //   store_id: cutterAvailabilityDto.store_id,
    //   shift_start_time: MoreThanOrEqual(
    //     this.utilityService.getStartOfTheDay(cutterAvailabilityDto.date),
    //   ),
    //   shift_end_time: LessThan(
    //     this.utilityService.getEndOfTheDay(cutterAvailabilityDto.date),
    //   ),
    //   status: 'active',
    // });

    const cutterQuery = `
        SELECT DISTINCT on (employee_user_id, shift_start_time, shift_type)
        * FROM mv_cutter_schedule
        WHERE
                store_id = '${cutterAvailabilityDto.store_id}'
                AND (
                  (shift_start_time >= '${startDate}' AND shift_end_time > '${startDate}')
                  OR
                  ('${startDate}' >= shift_start_time AND '${startDate}' <= shift_end_time)
                ) AND shift_end_time <= '${endDate}' AND status = 'active' AND is_deleted = false 
    `;

    let cutterSchedules = await this.cutterScheduleRepository.query(
      cutterQuery,
    );

    const cutterSchedulesByShift = cutterSchedules.filter(
      (cutterSchedule) => cutterSchedule.shift_type === 'shift',
    );

    const cutterSchedulesByOtherShift = cutterSchedules.filter(
      (cutterSchedule) =>
        cutterSchedule.shift_type === 'time_off' ||
        cutterSchedule.shift_type === 'lunch_break' ||
        cutterSchedule.shift_type === 'training',
    );

    await cutterSchedulesByShift.forEach(
      async (cutterScheduleByShift, index) => {
        const cutterSchedulesByOtherShiftByEmployee =
          cutterSchedulesByOtherShift.filter(
            (cutterScheduleByOtherShift) =>
              cutterScheduleByShift.employee_user_id ===
              cutterScheduleByOtherShift.employee_user_id,
          );
        if (
          cutterSchedulesByOtherShiftByEmployee &&
          cutterSchedulesByOtherShiftByEmployee.length > 0
        ) {
          await cutterSchedulesByOtherShiftByEmployee.forEach(
            async (cutterScheduleByOtherShiftByEmployee) => {
              const mvCutterSchedule = MvCutterSchedule.from(
                cutterScheduleByShift,
              );
              mvCutterSchedule.shift_end_time =
                cutterScheduleByOtherShiftByEmployee.shift_start_time;
              cutterSchedulesByShift.push(mvCutterSchedule);
              cutterScheduleByShift.shift_start_time =
                cutterScheduleByOtherShiftByEmployee.shift_end_time;
            },
          );
          const mvCutterSchedule = MvCutterSchedule.from(cutterScheduleByShift);
          mvCutterSchedule.shift_start_time =
            cutterScheduleByShift.shift_start_time;
          mvCutterSchedule.shift_end_time =
            cutterScheduleByShift.shift_end_time;
          cutterSchedulesByShift.push(mvCutterSchedule);

          cutterSchedulesByShift.splice(index, 1);
        }
      },
    );
    cutterSchedules = cutterSchedulesByShift;

    if (await this.utilityService.isNotEmptyObject(cutterSchedules)) {
      const cutters = [];
      await cutterSchedules.forEach(async (cutterSchedule) => {
        const existingCutter = cutters?.find(
          (cutter) =>
            cutter.employee_user_id === cutterSchedule.employee_user_id,
        );
        if (!existingCutter) {
          cutterSchedule['cutter_availability'] = [
            {
              shift_start_time: cutterSchedule['shift_start_time'],
              shift_end_time: cutterSchedule['shift_end_time'],
            },
          ];
          cutters.push(cutterSchedule);
        } else {
          existingCutter.cutter_availability.push({
            shift_start_time: cutterSchedule['shift_start_time'],
            shift_end_time: cutterSchedule['shift_end_time'],
          });
        }
      });
      const bookedCutters = await this.appointmentServiceRepository.find({
        relations: ['appointment'],
        where: {
          store_id: cutterAvailabilityDto.store_id,
          exp_start_date: MoreThanOrEqual(
            `${cutterAvailabilityDto.date} 00:00:00`,
          ),
          exp_end_date: LessThan(`${cutterAvailabilityDto.date} 23:59:59`),
          appointment: {
            is_cancelled: null,
          },
        },
      });
      const allKey = await this.redisService.keys(
        Constant.REDIS.userCartKey + '*',
      );
      if (await this.utilityService.isNotEmptyObject(allKey)) {
        const cartBookedCutters = await this.redisService.mget(allKey);
        if (await this.utilityService.isNotEmptyObject(cartBookedCutters)) {
          cartBookedCutters.forEach((cartBookedCutter) => {
            cartBookedCutter.forEach((cutter) => {
              if (
                cutter.store_id === cutterAvailabilityDto.store_id &&
                cutter.time_from &&
                cutter.time_to
              ) {
                bookedCutters.push(cutter);
              }
            });
          });
        }
      }
      for (const cutter of cutters) {
        /*const filteredBookedCutters = [];
        for (const bookedCutter of bookedCutters) {
          if (cutter.employee_id !== bookedCutter.cutter_id) {
            filteredBookedCutters.push(bookedCutter);
          }
        }*/

        let foundCuttersBookedArray = bookedCutters.filter((bc) => {
          return bc.cutter_id === cutter.employee_user_id;
        });

        // Note: to uncomment for fixed AMP-7723 & AMP-8370
        foundCuttersBookedArray.sort(function (x, y) {
          if (
            new Date(x['time_from'] ? x['time_from'] : x.exp_start_date) >
            new Date(y['time_from'] ? y['time_from'] : y.exp_start_date)
          ) {
            return 1;
          }
          if (
            new Date(x['time_from'] ? x['time_from'] : x.exp_start_date) <
            new Date(y['time_from'] ? y['time_from'] : y.exp_start_date)
          ) {
            return -1;
          }
          return 0;
        });

        // remove service from booked that has same time - 8423
        let existingSlotData = [];
        if (cutterAvailabilityDto.appointment_id) {
          const slotKeys =
            Constant.REDIS.editAppointmentSlotKey +
            cutterAvailabilityDto.appointment_id +
            `_${cutter.employee_user_id}`;
          if (slotKeys?.length) {
            existingSlotData = await this.redisService.get(slotKeys);

            if (existingSlotData?.length) {
              // remove service
              for (const slotObj of existingSlotData) {
                const objIndex = foundCuttersBookedArray.findIndex(
                  (obj) => obj.id == slotObj.appointment_service_id,
                );

                if (objIndex > -1) {
                  foundCuttersBookedArray[objIndex]['removeItem'] = true;
                }
              }
            }
            foundCuttersBookedArray = foundCuttersBookedArray.filter(
              (o) => !o['removeItem'],
            );
          }
        }

        if (foundCuttersBookedArray && foundCuttersBookedArray.length > 0) {
          cutter.cutter_availability.forEach((a) => {
            a.shift_start_time = this.removeTimeZone(a.shift_start_time);
            const final_shift_end_time = this.removeTimeZone(a.shift_end_time);
            foundCuttersBookedArray.forEach((b, i) => {
              if (i === 0) {
                a.shift_end_time =
                  b['time_from'] || this.removeTimeZone(b.exp_start_date);
              } else {
                cutter.cutter_availability.push({
                  shift_start_time:
                    foundCuttersBookedArray[i - 1]['time_to'] ||
                    this.removeTimeZone(
                      foundCuttersBookedArray[i - 1].exp_end_date,
                    ),
                  shift_end_time:
                    b['time_from'] || this.removeTimeZone(b.exp_start_date),
                });
              }
            });
            cutter.cutter_availability.push({
              shift_start_time:
                foundCuttersBookedArray[foundCuttersBookedArray.length - 1][
                  'time_to'
                ] ||
                this.removeTimeZone(
                  foundCuttersBookedArray[foundCuttersBookedArray.length - 1]
                    .exp_end_date,
                ),
              shift_end_time: final_shift_end_time,
            });
          });
        }

        cutter.cutter_availability.filter((ca, index) => {
          if (ca.shift_start_time === ca.shift_end_time) {
            cutter.cutter_availability.splice(index, 1);
          }
        });

        cutter.cutter_availability = await this.timeSlots(
          cutterAvailabilityDto['service_duration'],
          [],
          cutter.cutter_availability,
          cutterAvailabilityDto.req_type,
          null,
        );

        for (const cutter_availabilities of cutter.cutter_availability) {
          cuttersBySaloon.push(cutter_availabilities);
        }
      }
      cuttersBySaloon = await this.sortingTimestamp(cuttersBySaloon);

      cuttersBySaloon = cuttersBySaloon.filter((ca) => {
        return (
          new Date(ca.time_from) >= new Date(startDate) &&
          new Date(ca.time_to) <= new Date(endDate) &&
          storeCurrentDate &&
          new Date(ca.time_from) >= new Date(storeCurrentDate)
        );
      });
    }

    // add slot which are freed while editing an appointment - 8423
    if (cutterAvailabilityDto?.appointment_id) {
      const keys =
        Constant.REDIS.editAppointmentSlotKey +
        cutterAvailabilityDto.appointment_id +
        `_*`;
      const slotKeys = await this.redisService.keys(keys);

      if (slotKeys?.length) {
        let existingSlotData = await this.redisService.mget(slotKeys);
        existingSlotData = [].concat(...existingSlotData);
        // existingSlotData = await this.redisService.get(slotKeys);

        const slotsToInsert = [];
        if (existingSlotData?.length) {
          for (const obj of existingSlotData) {
            const startDate = moment(obj.time_from).format(
              Constant.DATE_FORMAT.YMD_HMD,
            );
            const endDate = moment(obj.time_to).format(
              Constant.DATE_FORMAT.YMD_HMD,
            );
            const dateDiff = moment(endDate).diff(startDate, 'minutes');

            if (dateDiff >= cutterAvailabilityDto.service_duration) {
              if (dateDiff === +cutterAvailabilityDto.service_duration) {
                // slotsToInsert.push({
                //   time_from: obj.time_from,
                //   time_to: obj.time_to,
                //   service_or_package_name: obj.service_or_package_name,
                //   guest_name: obj.guest_name,
                // });
                let indexToAssign = cuttersBySaloon.findIndex((caObj) => {
                  const cond =
                    caObj.time_from.toString() === obj.time_from.toString() &&
                    caObj.time_to.toString() === obj.time_to.toString();
                  if (cond) return cond;
                });

                const indexToAssign2 = cuttersBySaloon.findIndex((caObj) => {
                  // TODO:: check below condition when slots are not generated as same
                  const cond2 =
                    new Date(caObj.time_from) <= new Date(obj.time_to) &&
                    new Date(caObj.time_to) >= new Date(obj.time_from) &&
                    new Date(caObj.time_to) <= new Date(obj.time_to);

                  if (cond2) return cond2;
                });

                if (!indexToAssign) {
                  indexToAssign = indexToAssign2;
                }

                if (indexToAssign > -1) {
                  cuttersBySaloon[indexToAssign]['service_or_package_name'] =
                    obj.service_or_package_name;
                  cuttersBySaloon[indexToAssign]['guest_name'] = obj.guest_name;
                }
              } else {
                // calculate new slot based on minutes
                const newEndDate = moment(obj.time_from)
                  .add(+cutterAvailabilityDto.service_duration, 'minutes')
                  .format(Constant.DATE_FORMAT.YMD_THMD);
                // slotsToInsert.push({
                //   time_from: obj.time_from,
                //   time_to: newEndDate,
                //   service_or_package_name: obj.service_or_package_name,
                //   guest_name: obj.guest_name,
                // });
                const indexToAssign = cuttersBySaloon.findIndex((caObj) => {
                  const cond =
                    caObj.time_from.toString() === obj.time_from.toString() &&
                    caObj.time_to.toString() === newEndDate.toString();

                  return cond;
                });

                if (indexToAssign > -1) {
                  cuttersBySaloon[indexToAssign]['service_or_package_name'] =
                    obj.service_or_package_name;
                  cuttersBySaloon[indexToAssign]['guest_name'] = obj.guest_name;
                }
              }
            } else {
              // here incoming durating will be greater
              const indexToAssign = cuttersBySaloon.findIndex((caObj) => {
                const cond =
                  (new Date(caObj.time_from) <= new Date(obj.time_from) &&
                    new Date(caObj.time_to) >= new Date(obj.time_to)) ||
                  (new Date(caObj.time_from) <= new Date(obj.time_to) &&
                    new Date(caObj.time_to) >= new Date(obj.time_from) &&
                    new Date(caObj.time_to) <= new Date(obj.time_to));

                return cond;
              });

              if (indexToAssign > -1) {
                cuttersBySaloon[indexToAssign]['service_or_package_name'] =
                  obj.service_or_package_name;
                cuttersBySaloon[indexToAssign]['guest_name'] = obj.guest_name;
              }
            }
          }
        }
        cuttersBySaloon = [...cuttersBySaloon, ...slotsToInsert];
      }
    }
    this.logger.info(
      `AppointmentsService : Exit checkingCutteravailabilityBySaloon Method`,
    );
    this.ECSlogger.info(
      `AppointmentsService : Exit checkingCutteravailabilityBySaloon Method`,
    );
    return cuttersBySaloon;
  }

  async addToCart(addToCartDto: AddToCartDto, headers: any): Promise<any> {
    try {
      this.logger.info(`AppointmentsService : Enter addToCart Method`);
      this.ECSlogger.info(`AppointmentsService : Enter addToCart Method`);

      if (!headers['tenant_id']) {
        throw new Error('tenant_id is missing.');
      }

      let response = [];
      let message = '';
      addToCartDto['tenant_id'] = headers['tenant_id'];
      const id = addToCartDto.customer_id || headers.guest_user_id;
      let key = Constant.REDIS.userSerivceCartKey + id;

      if (addToCartDto.cutter_id) {
        const [cutterData] = await this.cutterScheduleRepository.query(
          `SELECT * FROM public.mv_cutter_schedule where employee_user_id = '${addToCartDto.cutter_id}'`,
        );

        if (cutterData?.status !== 'active') {
          throw new Error("You can't book inactive cutters");
        }
      }

      let where = '';
      if (addToCartDto.service_id && !addToCartDto.package_id) {
        key += `_${addToCartDto.service_id}`;
        where += `service_id = '${addToCartDto.service_id}'`;
      }

      // get store timing
      if (addToCartDto?.store_id) {
        const date = addToCartDto.time_from.split('T')[0];
        const { startDate, endDate, storeCurrentDate } =
          await this.getStoreOpenCloseTime(addToCartDto.store_id, date);
        if (
          startDate &&
          endDate &&
          new Date(addToCartDto.time_from) < new Date(startDate) &&
          new Date(addToCartDto.time_to) < new Date(endDate) &&
          new Date(addToCartDto.time_from) < new Date(storeCurrentDate)
        ) {
          throw new Error(
            'Selected slot should be between store open time and close time',
          );
        }
      } else {
        throw new Error('Store id is mendatory');
      }
      // Add expire time with configurable time limit
      const current_time = new Date().getTime();
      const new_time = current_time + Constant.REDIS.expireMinutes * 60 * 1000;
      addToCartDto['expire_time'] = new Date(new_time);

      if (addToCartDto.package_id) {
        key += `_${addToCartDto.package_id}`;
        where += `service_id = '${addToCartDto.package_id}'`;
      }

      const [serviceData] = await this.serviceRepository.query(
        `SELECT * FROM public.mv_services where ${where}`,
      );

      if (addToCartDto.store_id) {
        const [storeData] = await this.serviceRepository.query(
          `SELECT * FROM public.mv_stores where id = '${addToCartDto.store_id}'`,
        );

        if (storeData && storeData.status !== 2) {
          throw new Error("Store is inactive. You can't book from this store");
        }
      }

      if (serviceData && serviceData.status !== 'active') {
        throw new Error("You can't book this service. It is not active.");
      }

      const ttlTime = await this.getTTLTime(headers['tenant_id']);

      const getExistingData = await this.redisService.get(key);

      if (headers.guest_user_id) {
        addToCartDto['guest_user_id'] = headers.guest_user_id;
      }

      // If booking is done by preferred by saloon then assign random cutter (first match)
      if (!addToCartDto.cutter_id) {
        const time_from = new Date(addToCartDto.time_from);
        const time_to = new Date(addToCartDto.time_to);
        const timeDifference = this.getTimeDifference(time_to, time_from);
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
        const reqObj: any = {
          store_id: addToCartDto.store_id,
          date: onlyDate,
          service_duration: timeDifference,
          req_type: 'choose_cutter',
        };

        const cuttersAvailableSlots: any =
          await this.checkingCutteravailabilityByCutter(
            reqObj,
            headers['domain_name'],
            null,
            headers['tenant_id'],
          );
        let matchCutterId = '';
        let matchCutterStatus = null;
        let cutter_name = '';
        let matchCutterProfileImage = '';
        let foundCutter = false;
        for (let i = 0; i < cuttersAvailableSlots.length; i++) {
          for (
            let j = 0;
            j < cuttersAvailableSlots[i].cutter_availability.length;
            j++
          ) {
            if (
              cuttersAvailableSlots[i].cutter_availability[j].time_from ===
                addToCartDto.time_from &&
              cuttersAvailableSlots[i].cutter_availability[j].time_to ===
                addToCartDto.time_to
            ) {
              matchCutterId = cuttersAvailableSlots[i].employee_user_id;
              cutter_name = `${cuttersAvailableSlots[i]?.firstname} ${cuttersAvailableSlots[i]?.lastname}`;
              matchCutterStatus = cuttersAvailableSlots[i].status;
              matchCutterProfileImage = cuttersAvailableSlots[i].presigned_url;
              foundCutter = true;
              break;
            }
          }
          if (foundCutter) {
            break;
          }
        }
        if (!matchCutterId) {
          throw new Error('Cutter is not available in this time duration');
        }

        if (matchCutterStatus !== 'active') {
          throw new Error("You can't book inactive cutters");
        }

        addToCartDto['cutter_id'] = matchCutterId;
        addToCartDto['cutter_name'] = cutter_name;
        addToCartDto['cutter_profile_image'] = matchCutterProfileImage || '';
        addToCartDto['is_cutter_assigned'] = 1;
      } else {
        addToCartDto['is_cutter_assigned'] = 0;
      }

      // GEt all booked slots from redis
      const allKey = await this.redisService.keys(
        Constant.REDIS.userSerivceCartKey + '*',
      );

      let mainBookedSlotsArr = [];
      if (allKey && allKey.length) {
        const bookedSlots = await this.redisService.mget(allKey);
        mainBookedSlotsArr = [].concat(...bookedSlots);
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
          !obj.guest_name
        );
      });

      // obj.cutter_id === addToCartDto.cutter_id &&
      // obj.customer_id === addToCartDto.customer_id
      // check condition for guest
      if (addToCartDto.guest_name) {
        const checkAvilableSlots = mainBookedSlotsArr.find((obj) => {
          return (
            ((new Date(addToCartDto.time_from) >= new Date(obj.time_from) &&
              new Date(addToCartDto.time_from) < new Date(obj.time_to)) ||
              (new Date(addToCartDto.time_from) < new Date(obj.time_to) &&
                new Date(addToCartDto.time_to) > new Date(obj.time_from))) &&
            obj.cutter_id === addToCartDto.cutter_id &&
            headers['tenant_id'] === obj.tenant_id
          );
        });

        existingSlot = checkAvilableSlots;
      }

      // fetch data from DB to check the slog
      // let whereQuery = '';

      // if (addToCartDto.service_id && !addToCartDto.package_id) {
      //   whereQuery += `service_id = '${addToCartDto.service_id}'`;
      // }

      // if (addToCartDto.package_id) {
      //   whereQuery += `package_id = '${addToCartDto.package_id}'`;
      // }
      let bookedAppointments = await this.appointmentRepository.find({
        where: [
          {
            appointment_time: MoreThanOrEqual(
              moment(addToCartDto.time_from).format(
                Constant.DATE_FORMAT.YMD_HMD,
              ),
            ),
            appointment_end_time: LessThanOrEqual(
              moment(addToCartDto.time_to).format(Constant.DATE_FORMAT.YMD_HMD),
            ),
            client_id: id,
            tenant_id: headers['tenant_id'],
            is_cancelled: null,
          },
          {
            appointment_end_time: MoreThan(
              moment(addToCartDto.time_from).format(
                Constant.DATE_FORMAT.YMD_HMD,
              ),
            ),
            appointment_time: LessThan(
              moment(addToCartDto.time_to).format(Constant.DATE_FORMAT.YMD_HMD),
            ),
            client_id: id,
            tenant_id: headers['tenant_id'],
            is_cancelled: null,
          },
        ],
      });

      let bookedSlot = await this.appointmentServiceRepository.find({
        relations: ['appointment'],
        where: [
          {
            exp_start_date: MoreThanOrEqual(
              moment(addToCartDto.time_from).format(
                Constant.DATE_FORMAT.YMD_HMD,
              ),
            ),
            exp_end_date: LessThanOrEqual(
              moment(addToCartDto.time_to).format(Constant.DATE_FORMAT.YMD_HMD),
            ),
            cutter_id: addToCartDto.cutter_id,
            tenant_id: headers['tenant_id'],
            appointment: {
              is_cancelled: null,
            },
          },
          {
            exp_end_date: MoreThan(
              moment(addToCartDto.time_from).format(
                Constant.DATE_FORMAT.YMD_HMD,
              ),
            ),
            exp_start_date: LessThan(
              moment(addToCartDto.time_to).format(Constant.DATE_FORMAT.YMD_HMD),
            ),
            cutter_id: addToCartDto.cutter_id,
            tenant_id: headers['tenant_id'],
            appointment: {
              is_cancelled: null,
            },
          },
        ],
      });

      // AMP-8423
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
              const appointmentIndex = bookedAppointments.findIndex(
                (app) => app.id == slotObj.appointment_id,
              );
              if (appointmentIndex > -1) {
                bookedAppointments[appointmentIndex]['removeItem'] = true;
              }
              const appointmentServiceIndex = bookedSlot.findIndex(
                (app) => app.id == slotObj.appointment_service_id,
              );
              if (appointmentServiceIndex > -1) {
                bookedSlot[appointmentServiceIndex]['removeItem'] = true;
              }
              addToCartDto['appointment_service_id'] =
                slotObj.appointment_service_id;
            }

            bookedAppointments = bookedAppointments.filter(
              (o) => !o['removeItem'],
            );
            bookedSlot = bookedSlot.filter((o) => !o['removeItem']);
            addToCartDto['is_edit_appointment'] = true;

            // remove edit appointment keys from redis - 8423
            for (const k of slotsData) {
              this.redisService.del(k);
            }
          }
        }
      }

      if (
        existingSlot ||
        (bookedSlot && bookedSlot.length) ||
        (bookedAppointments?.length && !addToCartDto.guest_name)
      ) {
        if (
          existingSlot?.time_from === addToCartDto.time_from &&
          existingSlot?.time_to === addToCartDto.time_to &&
          existingSlot?.cutter_id !== addToCartDto.cutter_id
        ) {
          throw new Error(
            'You have already booked another cutter for this time duration',
          );
        } else if (
          existingSlot?.customer_id === addToCartDto.customer_id ||
          bookedAppointments?.length
        ) {
          throw new Error('You have already booked this time slot');
        } else {
          throw new Error('Cutter already booked in this time duration');
        }
      } else {
        // update TTL time of previous keys - amp-8455
        const previousKeyRegex = Constant.REDIS.userSerivceCartKey + id + '_*';
        const previousKeys = await this.redisService.keys(previousKeyRegex);

        if (previousKeys?.length) {
          for (const key of previousKeys) {
            const oldData = await this.redisService.get(key);
            const keyTtl = await this.redisService.getTtl(key);
            await this.redisService.set(key, oldData, ttlTime);
          }
        }

        if (getExistingData) {
          getExistingData.push(addToCartDto);
          response = getExistingData;
          const ttl = await this.redisService.getTtl(key);
          this.redisService.set(key, getExistingData, ttl);
          message = 'Cutter added to cart successfully.';
        } else {
          response = [addToCartDto];
          this.redisService.set(key, [addToCartDto], ttlTime);
          message = 'Cutter added to cart successfully.';
        }
      }
      this.logger.info(`AppointmentsService : Exit addToCart Method`);
      this.ECSlogger.info(`AppointmentsService : Exit addToCart Method`);
      return { response, message };
    } catch (error) {
      throw error;
    }
  }

  async removeFromCart(
    removeCartDto: AddToCartDto,
    headers: any,
  ): Promise<AddToCartDto[]> {
    this.logger.info(`AppointmentsService : Enter removeFromCart Method`);
    this.ECSlogger.info(`AppointmentsService : Enter removeFromCart Method`);
    const id = removeCartDto.customer_id || headers.guest_user_id;
    let key = Constant.REDIS.userSerivceCartKey + id;
    let getExistingData: any;
    if (removeCartDto.service_id) {
      key += `_${removeCartDto.service_id}`;
      getExistingData = await this.redisService.get(key);
    } else if (removeCartDto.package_id) {
      key += `_${removeCartDto.package_id}`;
      getExistingData = await this.redisService.get(key);
    } else {
      key += '_*';
      const userSerivceCartKeys = await this.redisService.keys(key);
      getExistingData = await this.redisService.mget(userSerivceCartKeys);
      getExistingData = [].concat(...getExistingData);
      for (const userSerivceCartKey of userSerivceCartKeys) {
        await this.redisService.del(userSerivceCartKey);
      }
      this.logger.info(`AppointmentsService : Exit removeFromCart Method`);
      return getExistingData;
    }

    if (getExistingData) {
      // found data in card with exact time and cutterId
      let preBookedSlotsIndex = getExistingData.findIndex((obj) => {
        return (
          (obj.service_id === removeCartDto.service_id ||
            obj.package_id === removeCartDto.package_id) &&
          removeCartDto.time_from == obj.time_from &&
          removeCartDto.time_to == obj.time_to &&
          !obj.guest_user_id
        );
      });

      if (removeCartDto.guest_user_id) {
        preBookedSlotsIndex = getExistingData.findIndex((obj) => {
          return (
            (obj.service_id === removeCartDto.service_id ||
              obj.package_id === removeCartDto.package_id) &&
            removeCartDto.time_from == obj.time_from &&
            removeCartDto.time_to == obj.time_to &&
            obj.guest_user_id === removeCartDto.guest_user_id
          );
        });
      }

      if (preBookedSlotsIndex > -1) {
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

        getExistingData.splice(preBookedSlotsIndex, 1);
        const ttl = await this.redisService.getTtl(key);
        if (getExistingData.length === 0) {
          await this.redisService.del(key);
        } else {
          this.redisService.set(key, getExistingData, ttl);
        }
      }
    }
    this.logger.info(`AppointmentsService : Exit removeFromCart Method`);
    this.ECSlogger.info(`AppointmentsService : Exit removeFromCart Method`);
    return getExistingData;
  }

  async getCartDetails(customerId: string, domain_name: string, headers: any) {
    this.logger.info(`AppointmentsService : Enter getCartDetails Method`);
    this.ECSlogger.info(`AppointmentsService : Enter getCartDetails Method`);

    if (!headers['tenant_id']) {
      throw new Error('tenant_id is missing.');
    }

    const key = Constant.REDIS.userSerivceCartKey + customerId + '_*';
    const allKeys = await this.redisService.keys(key);

    if (allKeys && allKeys.length) {
      let getExistingData: any = await this.redisService.mget(allKeys);
      getExistingData = [].concat(...getExistingData);
      getExistingData = getExistingData.filter(
        (obj) => obj.tenant_id === headers['tenant_id'],
      );
      getExistingData.sort(function (x, y) {
        if (new Date(x.time_from) > new Date(y.time_from)) {
          return 1;
        }
        if (new Date(x.time_from) < new Date(y.time_from)) {
          return -1;
        }
        return 0;
      });

      // get customer Data
      let customer_name = '';
      const [userData] = await this.customerUserRepository.find({
        where: {
          id: customerId,
        },
      });
      if (userData && userData?.fullname) {
        customer_name = `${userData?.fullname}`;
      }

      const configObj = await this.getFranchisorConfig(headers['tenant_id']);

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
        if (data.logo && domain_name) {
          data.logo = data.logo;
        } else {
          data.logo = configObj['default_service_image'];
        }

        const keyTtlTime = await this.redisService.getTtl(allKeys[0]);
        const minutes = keyTtlTime / 60;
        const timer_start_date = moment().format(Constant.DATE_FORMAT.YMD_THMD);
        const timer_end_date = moment(timer_start_date)
          .add(minutes, 'minutes')
          .format(Constant.DATE_FORMAT.YMD_THMD);

        data['timer_start_date'] = timer_start_date;
        data['timer_end_date'] = timer_end_date;

        if (data.cutter_profile_image && domain_name) {
          data.cutter_profile_image = data.cutter_profile_image;
        } else {
          data.cutter_profile_image = configObj['default_cutter_image'];
        }

        // get cutter's latest name
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

        data.customer_name = customer_name || data.customer_name;

        // Get store timezone details
        const storeData = allStoreData.find((s) => s.id === data.store_id);

        if (storeData) {
          // assign store timezone
          data['store_timezone_name'] = storeData?.timezone;
          data['store_timezone'] =
            Constant.static_timezone_pair[storeData.timezone.toUpperCase()];
        } else {
          data['store_timezone_name'] = 'GMT';
          data['store_timezone'] =
            Constant.static_timezone_pair['GMT'.toUpperCase()];
        }
      }

      // get music and beverages
      /*const musicBeveragesKey =
        Constant.REDIS.userMusicBeverageKey + customerId;
      const musicBeveragesRedisData = await this.redisService.get(
        musicBeveragesKey,
      );

      let musicBeverages = {};
      if (musicBeveragesRedisData) {
        musicBeverages = musicBeveragesRedisData;
      }*/

      // TODO :: once FE integrate music-beverages api
      // return { appointments: getExistingData, musicBeverages };
      return getExistingData;
    }
    this.logger.info(`AppointmentsService : Exit getCartDetails Method`);
    this.ECSlogger.info(`AppointmentsService : Exit getCartDetails Method`);
    return [];
  }

  async confirmAppointment(
    headers: any,
    confirmAppointmentDto: AppointmentConfirmDto,
  ) {
    try {
      // get cart data from redis
      const id = headers.customer_id || headers.guest_user_id;
      const key = Constant.REDIS.userSerivceCartKey + id + '_*';
      const allKeys = await this.redisService.keys(key);
      // const key = Constant.REDIS.userCartKey + headers.customer_id;
      // const getExistingData = await this.redisService.get(key);

      const configObj = await this.getFranchisorConfig(headers['tenant_id']);

      // get customer's - guest's latest name
      let customer_name = '';
      let guest_user_name = '';

      if (headers.customer_id) {
        const [userData] = await this.customerUserRepository.find({
          where: {
            id: headers.customer_id,
          },
        });
        if (userData && userData?.fullname) {
          customer_name = `${userData?.fullname}`;
        }
      }

      if (headers.guest_user_id) {
        guest_user_name = await this.getGuestName(headers.guest_user_id);
      }

      if (allKeys && allKeys.length) {
        let getExistingData: any = await this.redisService.mget(allKeys);
        getExistingData = [].concat(...getExistingData);
        // sort data based on start date
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
              new Date(obj.time_from).getTime(),
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

        const [notificationCategory] =
          await this.notificationCategoryRepository.find({
            where: {
              category: 'BOOK_APPOINTMENT',
            },
          });
        const notificationTypes = await this.notificationTypeRepository.find();

        let overallPrice = 0;
        const totalAppointments: any = Object.values(appointmentObj);
        if (totalAppointments && totalAppointments.length) {
          const customerConfigObj =
            await this.franchisorConfigRepository.findOne({
              where: {
                category: 'customer_config',
                tenant_id: headers.tenant_id,
              },
            });
          for (const currentAppointmentArr of totalAppointments) {
            // create appointMent Object first
            // get store details to generate appointment uniq id
            let store_name = '';
            const [latestStoreData] = await this.storeDetailRepository.query(
              `SELECT * FROM public.mv_stores where id = '${currentAppointmentArr[0].store_id}'`,
            );

            if (latestStoreData) {
              store_name = latestStoreData.name;
            }
            const appointment_uniq_id =
              this.generateNewAppointmentUniqId(store_name);
            let rebookStatus = 'false';

            if (
              confirmAppointmentDto?.is_rebook_by_admin &&
              confirmAppointmentDto?.is_rebook_by_admin
                .toString()
                .toLowerCase() === 'true'
            ) {
              rebookStatus = 'true';
            }

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
              beverages: confirmAppointmentDto.beverages
                ? confirmAppointmentDto.beverages
                : null,
              music: confirmAppointmentDto.music
                ? confirmAppointmentDto.music
                : null,
              cancellation_charge: customerConfigObj
                ? customerConfigObj.value['cancellation_percent']
                : null,
              booked_from: booked_from || null,
            };

            currentAppointmentArr.forEach((obj) => {
              if (headers.customer_id) {
                obj.customer_name = customer_name || '';
              }

              if (headers.guest_user_id) {
                obj.customer_name = guest_user_name || '';
              }
            });
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
            overallPrice += total_price;

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

            if (confirmAppointmentDto) {
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
                  card_holder_name:
                    confirmAppointmentDto.card_holder_name || null,
                  expiry_date: confirmAppointmentDto.expiry_date || null,
                  pg_customer_id:
                    confirmAppointmentDto['pg_customer_id'] || null,
                };
              }

              appointmentObj['payment_mode'] =
                confirmAppointmentDto.payment_mode || 'online';
              appointmentObj['card_details'] = cardObj;
              appointmentObj['is_rebook_by_admin'] = rebookStatus;
            }

            const savedAppoinment = await this.appointmentRepository.save(
              AppointmentBookDto.toEntity(appointmentObj),
            );

            // TODO:: Make below parameters dynamic in future
            currentAppointmentArr.forEach((obj) => {
              obj['appointment_uniq_id'] = appointment_uniq_id;
            });

            const service_name = [];
            const guest_name = [];
            const cutter_name = [];
            let storeData;
            let foundStore = true;
            let userData = null;
            if (headers.customer_id) {
              try {
                userData = await this.usersService.findOne(headers.customer_id);
              } catch (err) {
                this.logger.error(
                  `Error: AppointmentsService: confirmAppointment => ${err}`,
                );
              }
            }
            if (headers.guest_user_id) {
              userData = await this.customerGuestUserRepository.findOne(
                headers.guest_user_id,
              );
            }

            for (const service of currentAppointmentArr) {
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
                package_id: service.package_id || null,
                service_option_id: service.service_option_id || null,
                cutter_note: service.cutter_note || null,
                service_option_name: service.service_option_name || null,
                service_option_price: service.service_option_price || null,
                is_cutter_assigned: +service.is_cutter_assigned || 0,
                service_or_package_name: service?.name || '',
                approx_time: service?.approx_time || 0,
              };

              // TODO :: check values of deviceType in header
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

              if (foundStore) {
                storeData = await this.storeDetailRepository.query(
                  `SELECT * FROM public.mv_stores where id = '${service.store_id}'`,
                );
                foundStore = false;

                //update appointment with store's timezone
                await this.appointmentRepository.update(
                  {
                    id: savedAppoinment.id,
                  },
                  {
                    store_timezone: storeData[0]?.timezone,
                  },
                );
                currentAppointmentArr[0]['store_timezone'] =
                  storeData[0]?.timezone;
              }

              if (service?.logo) {
                service.logo = service.logo;
              } else {
                service.logo = configObj['default_service_image'];
              }

              if (service?.cutter_profile_image) {
                service.cutter_profile_image = service.cutter_profile_image;
              } else {
                service.cutter_profile_image =
                  configObj['default_cutter_image'];
              }

              if (service?.cutter_profile_image) {
                service.cutter_profile_image = service.cutter_profile_image;
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

            // emit event in rabbitmq
            if (userData) {
              let message = `You booked ${service_name.join(', ')} services `;
              if (guest_name.length) {
                message += 'for ' + guest_name.join(', ') + ' ';
              }
              message +=
                storeData && storeData.length ? 'at ' + storeData[0].name : '';
              const suite_number =
                storeData && storeData.length && storeData[0].suite_number
                  ? storeData[0].suite_number + ', '
                  : '';
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
                  currentAppointmentArr[
                    currentAppointmentArr.length - 1
                  ].time_to,
                ),
                created_by: headers.customer_id
                  ? headers.customer_id
                  : headers.guest_user_id,

                appointment_id: savedAppoinment.id,
                service_name: service_name.join(', '),
                date_time: new Date(currentAppointmentArr[0].time_from),
                time_from: new Date(currentAppointmentArr[0].time_from),
                time_to: new Date(
                  currentAppointmentArr[
                    currentAppointmentArr.length - 1
                  ].time_to,
                ),
                customer_name,
                guest_name: guest_name.join(', '),
                cutter_name: cutter_name.join(', '),
                service_price: total_discounted_price,
                store_name:
                  storeData && storeData.length ? storeData[0].name : '',
                store_timezone:
                  storeData && storeData.length ? storeData[0].timezone : '',
                store_address:
                  storeData && storeData.length
                    ? storeData[0].address +
                      ', ' +
                      storeData[0].street_name +
                      ', ' +
                      suite_number +
                      storeData[0].city +
                      ', ' +
                      storeData[0].state +
                      ', ' +
                      storeData[0].zipcode
                    : '',
                brand_name:
                  franchisorData && franchisorData.brand_name
                    ? franchisorData.brand_name
                    : null,
                brand_logo: 'https://google.com',
                domain_name: headers['domain_name'],
                store_contact: storeData?.length
                  ? storeData[0]?.primary_contact
                  : null,
                store_id: storeData?.length ? storeData[0]?.id : '',
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
              } else if (userData.phone) {
                // notificationObj['mobile_number'] = userData.mobile;
                notificationObj['mobile_number'] =
                  userData.preferred_phone || userData.phone;
                notificationObj['customer_name'] =
                  userData?.fullname.toLowerCase() === 'anonymous' ||
                  !userData.fullname
                    ? 'Guest(Anonymous)'
                    : userData.fullname;
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
              // publish message to rabbitmq
              await this.rabbitMQService.emitMqMessages(
                'create_notification',
                notificationObj,
              );
            }
          }
        }

        // Delete cart data from redis
        this.redisService.del(allKeys);
        // const totalAmountPaid = []
        //   .concat(...totalAppointments)
        //   .reduce((acc, obj) => {
        //     return acc + parseFloat(obj.price);
        //   }, 0);
        const totalAmountPaid = overallPrice;
        return {
          data: totalAppointments,
          totalAmountPaid,
          message: 'Appointment booked successfully.',
        };
      } else {
        throw new Error('No data found in cart.');
      }
    } catch (err) {
      throw err;
    }
  }

  async getTTLTime(tenant_id) {
    // return Constant.REDIS.TTL;
    // GET time limit from franchisor config
    // TODO:: Using franchasior config table directly
    const [configObj] = await this.franchisorConfigRepository.find({
      where: {
        category: 'appointment_service_config',
        tenant_id,
      },
    });

    return configObj && configObj.value['cart_timer_mins']
      ? +configObj.value['cart_timer_mins'] * 60
      : Constant.REDIS.TTL;
  }

  async fetchNearbyStores(
    latitude,
    longitude,
    paginationObj: any,
    tenant_id: any,
    domain_name: string,
    customer_id: string,
  ) {
    const getNearbyDistance = tenant_id
      ? await this.storeDetailRepository.query(
          `select value from config_franchisor_config where category = 'appointment_service_config' AND tenant_id = '${tenant_id}'`,
        )
      : `${process.env.NEARBY_DISTANCE}`;
    const nearByDistance =
      tenant_id && getNearbyDistance[0]
        ? getNearbyDistance[0].value['near_by_distance']
        : `${process.env.NEARBY_DISTANCE}`;

    const nearbyRecords = [];
    const query = `select Distinct(id), name, service_count, franchisor_name, geo_lat, geo_long, logo, description, country, city, address, street_name, zipcode, status, 
    CAST(distance as decimal(10,2)) from (SELECT
          stores.id, (SELECT COUNT(DISTINCT services.service_id) FROM public.mv_services services WHERE stores.id = services.store_id AND services.status = 'active') AS service_count, stores.name, stores.franchisor_name, stores.geo_lat, stores.geo_long, stores.logo, 
                        stores.description, stores.country, stores.city, stores.address, stores.street_name, stores.zipcode, stores.status, (
      3959 * acos (
        cos ( radians(${latitude}) )
        * cos( radians(cast (geo_lat as DOUBLE PRECISION) ))
        * cos( radians(cast(geo_long as DOUBLE PRECISION)) - radians(${longitude}) )
        + sin ( radians(${latitude}) )
        * sin( radians(cast (geo_lat as DOUBLE PRECISION) ))
      )
    ) AS distance
  FROM public.mv_stores stores WHERE tenant_id = '${tenant_id}') as distance Where distance <= ${nearByDistance} AND distance.status = '2' ORDER BY distance ASC`;

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
        value['rating'] = '3';

        // assign favourite flag
        if (fav_stores?.length && fav_stores.find((fav) => fav === value.id)) {
          value['is_store_favourite'] = true;
        } else {
          value['is_store_favourite'] = false;
        }
        // Get presigned_url of store images/logo
        let presigned_url = '';
        let logo = '';
        if (value.logo) {
          presigned_url = value.logo;
          logo = value.logo;
        } else {
          presigned_url = configObj['default_store_image'] || '';
          logo = configObj['default_store_image'] || '';
        }
        value['presigned_url'] = presigned_url;
        value['logo'] = logo;
        // Making use of google API to calculate estimated travel time
        /*try {
          const getTravelTime = await this.(
            latitude,
            longitude,
            value['geo_lat'],
            value['geo_long'],
          );*/
        value['estimated_time'] = '-';
        value['estimated_time_sec'] = 0;
        /*} catch (error) {
          return error.response;
        }*/
        nearbyRecords.push(value);
      }
    }
    return {
      nearbyRecords: nearbyStoresDetails,
      totalCount: totalRecords.length,
    };
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
      domain_name,
      null,
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

  async findPreviousAppointments(
    customer_id: string,
    paginationObj: any,
    date: string,
    domain_name: string,
    tenant_id: string,
  ): Promise<any> {
    this.logger.info(
      `AppointmentsService : Enter findPreviousAppointments Method`,
    );
    this.ECSlogger.info(
      `AppointmentsService : Enter findPreviousAppointments Method`,
    );
    const todayDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_END);
    let appointments = await this.appointmentRepository.find({
      relations: ['service_booked'],
      where: {
        client_id: customer_id,
        appointment_time: LessThanOrEqual(todayDate),
        status: Not('booked'),
      },
      order: {
        appointment_time: 'DESC',
      },
      skip: (paginationObj.skip - 1) * paginationObj.limit,
      take: paginationObj.limit,
    });

    let totalCount = await this.appointmentRepository.find({
      relations: ['service_booked'],
      where: {
        client_id: customer_id,
        appointment_time: LessThanOrEqual(todayDate),
        status: Not('booked'),
      },
    });

    totalCount = totalCount.filter((a) => {
      return a.service_booked && a.service_booked.length > 0;
    });

    appointments = await this.getAppoinmentServiceDetail(
      appointments,
      domain_name,
      null,
      tenant_id,
    );

    appointments = await this.filterAppointmentsBasedOnTimeZone(
      appointments,
      'previous',
    );

    totalCount = await this.getAppoinmentServiceDetail(
      totalCount,
      domain_name,
      null,
      tenant_id,
    );

    totalCount = await this.filterAppointmentsBasedOnTimeZone(
      totalCount,
      'previous',
    );

    this.logger.info(
      `AppointmentsService : Exit findPreviousAppointments Method`,
    );
    this.ECSlogger.info(
      `AppointmentsService : Exit findPreviousAppointments Method`,
    );
    return { appointments, totalCount: totalCount.length };
  }

  async findUpcomingAppointments(
    customer_id: string,
    paginationObj: any,
    date: string,
    domain_name: string,
    tenant_id: string,
  ): Promise<any> {
    this.logger.info(
      `AppointmentsService : Enter findUpcomingAppointments Method`,
    );
    this.ECSlogger.info(
      `AppointmentsService : Enter findUpcomingAppointments Method`,
    );
    const todayDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_START);
    let appointments = await this.appointmentRepository.find({
      relations: ['service_booked'],
      where: {
        client_id: customer_id,
        appointment_time: MoreThan(todayDate),
        status: 'booked',
      },
      order: {
        appointment_time: 'ASC',
      },
      skip: (paginationObj.skip - 1) * paginationObj.limit,
      take: paginationObj.limit,
    });

    let totalCount = await this.appointmentRepository.find({
      relations: ['service_booked'],
      where: {
        client_id: customer_id,
        appointment_time: MoreThan(todayDate),
        status: 'booked',
      },
    });

    totalCount = totalCount.filter((a) => {
      return a.service_booked && a.service_booked.length > 0;
    });

    appointments = await this.getAppoinmentServiceDetail(
      appointments,
      domain_name,
      null,
      tenant_id,
    );

    appointments = await this.filterAppointmentsBasedOnTimeZone(
      appointments,
      'upcoming',
    );

    totalCount = await this.getAppoinmentServiceDetail(
      totalCount,
      domain_name,
      null,
      tenant_id,
    );

    totalCount = await this.filterAppointmentsBasedOnTimeZone(
      totalCount,
      'upcoming',
    );

    this.logger.info(
      `AppointmentsService : Exit findUpcomingAppointments Method`,
    );
    this.ECSlogger.info(
      `AppointmentsService : Exit findUpcomingAppointments Method`,
    );
    return { appointments, totalCount: totalCount.length };
  }

  async findAllAppointment(
    customer_id: string,
    paginationObj: any,
    date: string,
    cutterId: string,
    guest_user_id: string,
    tenant_id: string,
    domain_name: string,
  ): Promise<any> {
    try {
      this.logger.info(`AppointmentsService : Enter findAllAppointment Method`);
      let where = {};
      if (customer_id) {
        where = {
          client_id: customer_id,
        };
      }

      if (guest_user_id) {
        where = {
          guest_user_id: guest_user_id,
        };
      }

      if (date) {
        const startDate = moment(date, 'YYYY-MM-DD')
          .set({ hour: 0, minute: 0, second: 0 })
          .format(Constant.DATE_FORMAT.YMD_HMD);
        const endDate = moment(date, 'YYYY-MM-DD')
          .set({ hour: 23, minute: 59, second: 59 })
          .format(Constant.DATE_FORMAT.YMD_HMD);
        where = {
          appointment_time: Between(startDate, endDate),
        };
        if (tenant_id) {
          where['tenant_id'] = tenant_id;
        }
      }
      let appointments = await this.appointmentRepository.find({
        relations: ['service_booked'],
        where,
        order: {
          checkin_time: 'DESC',
        },
        skip: (paginationObj.skip - 1) * paginationObj.limit,
        take: paginationObj.limit,
      });

      let totalCount = await this.appointmentRepository.find({
        relations: ['service_booked'],
        where,
      });

      totalCount = totalCount.filter((a) => {
        return a.service_booked && a.service_booked.length > 0;
      });

      appointments = await this.getAppoinmentServiceDetail(
        appointments,
        domain_name,
        cutterId,
        tenant_id,
      );

      // calculate upcoming, ongoing and completed count
      // const countObj = {};

      // countObj['upcoming'] =
      //   appointments.filter(
      //     (app) => app.appointment_time > new Date(),
      //   ).length || 0;
      // countObj['ongoing'] =
      //   appointments.filter((app) => app.status === 'ongoing').length || 0;
      // countObj['completed'] =
      //   appointments.filter((app) => app.status === 'completed').length || 0;

      // this.logger.info(`AppointmentsService : Exit findAllAppointment Method`);
      return {
        appointments,
        totalCount: totalCount.length,
      };
    } catch (error) {
      throw error;
    }
  }

  async addInstruction(
    addInstructionDto: AddInstructionDto,
    customer_id: string,
    guest_user_id: string,
  ): Promise<any> {
    this.logger.info(`AppointmentsService : Enter addInstruction Method`);
    this.ECSlogger.info(`AppointmentsService : Enter addInstruction Method`);

    const id = customer_id || guest_user_id;
    let key = Constant.REDIS.userSerivceCartKey + id;
    if (addInstructionDto.service_id) {
      key += `_${addInstructionDto.service_id}`;
    }

    if (addInstructionDto.package_id) {
      key += `_${addInstructionDto.package_id}`;
    }
    const getExistingData = await this.redisService.get(key);

    if (getExistingData) {
      const foundServiceIndex = getExistingData.findIndex(
        (data) =>
          (data.service_id === addInstructionDto.service_id ||
            data.package_id === addInstructionDto.package_id) &&
          (data.customer_id === id || data.guest_user_id === id) &&
          data.time_from === addInstructionDto.time_from &&
          data.time_to === addInstructionDto.time_to,
      );
      // getExistingData['cutter_note'] = addInstructionDto.cutter_note;

      // const ttl = await this.redisService.getTtl(key);
      // this.redisService.set(key, getExistingData, ttl);
      // this.logger.info(`AppointmentsService : Exit addInstruction Method`);
      // return { message: 'Instruction successfully added.' };
      if (foundServiceIndex !== -1) {
        getExistingData[foundServiceIndex]['cutter_note'] =
          addInstructionDto.cutter_note;
        const ttl = await this.redisService.getTtl(key);
        this.redisService.set(key, getExistingData, ttl);
        return { message: 'Instruction successfully added.' };
      } else {
        return { message: 'Service not found in the cart.' };
      }
    } else {
      return {
        message: 'Please add data into the cart.',
      };
    }
  }

  async addMusicAndBeverages(
    addMusicBeveragesDto: AddMusicBeveragesDto,
    customer_id: string,
    guest_user_id: string,
    headers: any,
  ) {
    this.logger.info(`AppointmentsService : Enter addMusicAndBeverages Method`);
    this.ECSlogger.info(
      `AppointmentsService : Enter addMusicAndBeverages Method`,
    );

    const id = customer_id || guest_user_id;
    const key = Constant.REDIS.userMusicBeverageKey + id;

    const getExistingData = await this.redisService.get(key);

    this.logger.info(`AppointmentsService : Exit addMusicAndBeverages Method`);
    this.ECSlogger.info(
      `AppointmentsService : Exit addMusicAndBeverages Method`,
    );

    if (getExistingData) {
      const ttl = await this.redisService.getTtl(key);
      this.redisService.set(key, addMusicBeveragesDto, ttl);
      return { message: 'Music and beverates saved successfully.' };
    } else {
      const ttlTime = await this.getTTLTime(headers['tenant_id']);
      this.redisService.set(key, addMusicBeveragesDto, ttlTime);
      return {
        message: 'Music and beverates saved successfully.',
      };
    }
  }

  async getCancellationPolicy(domain_name: string, tenant_id: string) {
    try {
      this.logger.info(
        `AppointmentService : Enter getCancellationPolicy Method`,
      );
      this.ECSlogger.info(
        `AppointmentService : Enter getCancellationPolicy Method`,
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

  async appointmentUpdate(
    updateAppointmentDto: UpdateAppointment,
    tenant_id: string,
    domain_name: string,
  ) {
    try {
      this.logger.info(`AppointmentsService : Enter appointmentUpdate Method`);
      this.ECSlogger.info(
        `AppointmentsService : Enter appointmentUpdate Method`,
      );

      const [appointmentData] = await this.appointmentRepository.find({
        relations: ['service_booked'],
        where: {
          id: updateAppointmentDto.appointment_id,
        },
      });

      const franchisorData = await this.franchisorRepository.findOne(tenant_id);

      /*const todayDate = new Date();
      if (todayDate > new Date(appointmentData?.appointment_time)) {
        throw new Error('Only upcoming appointments can be updated.');
      }*/
      const store_id = appointmentData?.service_booked[0].store_id;

      const store_current_date = await this.getCurrentDateTimeOfStore(
        store_id,
        null,
      );

      if (appointmentData) {
        if (
          updateAppointmentDto.type === 'checkin' ||
          updateAppointmentDto.type === 'checkout'
        ) {
          // const startDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_START);
          // const endDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_END);
          const startDate = moment(store_current_date).format(
            Constant.DATE_FORMAT.YMD_HMD_START,
          );
          const endDate = moment(store_current_date).format(
            Constant.DATE_FORMAT.YMD_HMD_END,
          );

          const appointment_date = new Date(appointmentData?.appointment_time);
          if (
            // appointment_date < new Date(startDate) ||
            // appointment_date > new Date(endDate)
            appointment_date < new Date(startDate) ||
            appointment_date > new Date(endDate)
          ) {
            throw new Error("You can only modify today's appointment");
          }
        }

        if (updateAppointmentDto.type === 'checkin') {
          // const store_id = appointmentData?.service_booked[0].store_id;

          // const store_current_date = await this.getCurrentDateTimeOfStore(
          //   store_id,
          //   null,
          // );
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

              const [cutterData] = await this.serviceRepository.query(
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
              this.ECSlogger.info(
                `AppointmentsService : appointmentUpdate : notificationObj : ${JSON.stringify(
                  notificationObj,
                )}`,
              );
              // publish message to rabbitmq
              await this.rabbitMQService.emitMqMessages(
                'save_notification',
                notificationObj,
              );
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
          await this.appointmentRepository.update(
            {
              id: updateAppointmentDto.appointment_id,
            },
            {
              cancellation_reason: updateAppointmentDto.cancellation_reason,
              cancellation_charge: updateAppointmentDto.charge,
              reason_for_no_show: updateAppointmentDto?.reason_for_no_show,
              status: 'completed',
              is_cancelled: 1,
            },
          );

          const [appointmentService] =
            await this.appointmentServiceRepository.find({
              where: {
                appointment_id: updateAppointmentDto.appointment_id,
              },
            });

          if (appointmentService) {
            // get category id from notification_category table
            const [notificationCategory] =
              await this.notificationCategoryRepository.find({
                where: {
                  category: 'CANCEL_APPOINTMENT',
                },
              });

            const [serviceData] = await this.appointmentViewRepository.query(
              `SELECT * FROM public.mv_services where service_id = '${appointmentService.service_id}'`,
            );

            const [storeData] = await this.appointmentViewRepository.query(
              `SELECT * FROM public.mv_stores where id = '${appointmentService.store_id}'`,
            );

            if (serviceData && storeData) {
              const notificationObj: any = {
                tenant_id: tenant_id,
                category_id: notificationCategory.id,
                user_type: 'customer',
                title: `Appointment Cancelled`,
                message_id: updateAppointmentDto.appointment_id,
                message: `You cancelled ${serviceData.service_name} services for you at ${storeData.name}`,
                schedule_time: new Date(appointmentService.exp_start_date),
                receiver_id: appointmentData.client_id,
                expiry_date: new Date(appointmentService.exp_end_date),
                created_by: appointmentData.client_id,
                domain_name: domain_name,
                store_contact: storeData.primary_contact,
                store_id: storeData.id,
                store_timezone: storeData.timezone,
                store_name: storeData.name,
                time_from: new Date(appointmentData.appointment_time),
                time_to: new Date(appointmentData.appointment_end_time),
                brand_name:
                  franchisorData && franchisorData.brand_name
                    ? franchisorData.brand_name
                    : null,
              };

              let userData = null;
              try {
                userData = await this.usersService.findOne(
                  appointmentData.client_id,
                );
              } catch (err) {
                this.logger.error(
                  `Error: AppointmentsService: appointmentUpdate => ${err}`,
                );
                this.ECSlogger.error(
                  `Error: AppointmentsService: appointmentUpdate => ${err}`,
                );
              }
              // if (
              //   userData.device_token &&
              //   userData.customer_preference &&
              //   userData.customer_preference.preference &&
              //   userData.customer_preference.preference.push_notifications
              // ) {
              //   notificationObj['token'] = userData.device_token;
              //   const notificaitonType =
              //     await this.notificationTypeRepository.findOne({ type: '1' });
              //   notificationObj['notification_type'] = notificaitonType.id;
              // }

              // SMS obj
              if (
                userData &&
                userData.phone &&
                userData.customer_preference &&
                userData.customer_preference.preference &&
                userData.customer_preference.preference.text_messages
              ) {
                notificationObj['token'] = userData.device_token;
                notificationObj['mobile_number'] = userData.phone;
                notificationObj['customer_name'] = userData.fullname;
                // notificationObj['to'] = userData.email;
                const notificaitonType =
                  await this.notificationTypeRepository.findOne({
                    type: '100',
                  });
                notificationObj['notification_type'] = notificaitonType.id;
              }
              this.logger.info(
                `AppointmentsService : appointmentUpdate : notificationObj : ${JSON.stringify(
                  notificationObj,
                )}`,
              );
              this.ECSlogger.info(
                `AppointmentsService : appointmentUpdate : notificationObj : ${JSON.stringify(
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

        // AMP-7966
        if (updateAppointmentDto.type === 'rollback-checkout') {
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

        if (updateAppointmentDto.type === 'rollback-checkin') {
          await this.appointmentRepository.update(
            {
              id: updateAppointmentDto.appointment_id,
            },
            {
              checkin_time: null,
              checkout_time: null,
              status: 'booked',
            },
          );

          // remove actual start and actual end from services
          await this.appointmentServiceRepository.update(
            {
              appointment_id: updateAppointmentDto.appointment_id,
            },
            {
              actual_start_time: null,
              actual_end_time: null,
            },
          );
        }

        if (updateAppointmentDto.type === 'edit') {
          // get cart data from redis
          const key =
            Constant.REDIS.userSerivceCartKey +
            appointmentData.client_id +
            '_*';
          const allKeys = await this.redisService.keys(key);
          if (allKeys && allKeys.length) {
            let getExistingData: any = await this.redisService.mget(allKeys);
            getExistingData = [].concat(...getExistingData);
            // sort data based on start date
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
                  new Date(obj.time_from).getTime(),
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
              // Delete old appointment service
              await this.appointmentServiceRepository.delete({
                appointment_id: appointmentData.id,
              });

              for (const currentAppointmentArr of totalAppointments) {
                // Update appointment obj
                appointmentData.discount =
                  currentAppointmentArr[0].discount || 0;
                appointmentData.appointment_time = new Date(
                  currentAppointmentArr[0].time_from,
                );
                appointmentData.appointment_end_time = new Date(
                  currentAppointmentArr[
                    currentAppointmentArr.length - 1
                  ].time_to,
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

                // delete slot keys from redis
                const slotKey =
                  Constant.REDIS.editAppointmentSlotKey +
                  updateAppointmentDto.appointment_id +
                  '_*';
                const slotKeys = await this.redisService.keys(slotKey);
                if (slotKeys?.length > 0) {
                  // Delete cart data from redis
                  this.redisService.del(slotKeys);
                }

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
            for (const k of allKeys) {
              this.redisService.del(k);
            }
          } else {
            throw new Error('No data found in cart.');
          }
        }

        this.logger.info(`AppointmentsService : Exit appointmentUpdate Method`);
        this.ECSlogger.info(
          `AppointmentsService : Exit appointmentUpdate Method`,
        );

        return { message: 'Appointment updated successfully.' };
      } else {
        throw new Error('Appointment not found');
      }
    } catch (error) {
      this.logger.error(
        `AppointmentsService : ERROR in catch block appointmentUpdate Method`,
      );
      this.ECSlogger.error(
        `AppointmentsService : ERROR in catch block appointmentUpdate Method`,
      );
      throw error;
    }
  }

  async appointmentServiceUpdate(
    updateAppointmentServiceDto: UpdateAppointmentService,
  ) {
    try {
      this.logger.info(
        `AppointmentsService : Enter appointmentServiceUpdate Method`,
      );
      this.ECSlogger.info(
        `AppointmentsService : Enter appointmentServiceUpdate Method`,
      );

      const response = {};

      const [appointmentData] = await this.appointmentServiceRepository.find({
        id: updateAppointmentServiceDto.appointment_service_id,
      });

      const store_id = appointmentData.store_id;

      const store_current_date = await this.getCurrentDateTimeOfStore(
        store_id,
        null,
      );

      // update appointment_appointment object
      let appointmentServices = [];

      if (appointmentData) {
        // const startDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_START);
        // const endDate = moment().format(Constant.DATE_FORMAT.YMD_HMD_END);

        const startDate = moment(store_current_date).format(
          Constant.DATE_FORMAT.YMD_HMD_START,
        );
        const endDate = moment(store_current_date).format(
          Constant.DATE_FORMAT.YMD_HMD_END,
        );

        const appointment_date = new Date(appointmentData?.exp_start_date);
        if (
          appointment_date < new Date(startDate) ||
          appointment_date > new Date(endDate)
        ) {
          throw new Error("You can only modify today's appointment");
        }

        if (
          updateAppointmentServiceDto.type === 'start' ||
          updateAppointmentServiceDto.type === 'rollback-start'
        ) {
          const updateObj = {
            actual_start_time: new Date(),
          };

          if (updateAppointmentServiceDto.type === 'rollback-start') {
            updateObj.actual_start_time = null;
            updateObj['extra_time'] = 0;
          }

          let whereObj = {};
          if (appointmentData.package_id) {
            whereObj = {
              package_id: appointmentData.package_id,
              exp_start_date: appointmentData.exp_start_date,
            };
          } else {
            whereObj = {
              id: updateAppointmentServiceDto.appointment_service_id,
            };
          }

          await this.appointmentServiceRepository.update(whereObj, updateObj);

          appointmentServices = await this.appointmentServiceRepository.find({
            appointment_id: appointmentData.appointment_id,
          });

          if (updateAppointmentServiceDto.type === 'start') {
            // set key in redis
            const key =
              Constant.REDIS.service_key +
              updateAppointmentServiceDto.appointment_service_id;
            const [serviceData] = await this.serviceRepository.query(
              `SELECT * FROM public.mv_services WHERE service_id = '${appointmentData.service_id}'`,
            );

            const ttlTime = serviceData['approx_time']
              ? +(serviceData['approx_time'].split(':')[0] * 60) +
                +serviceData['approx_time'].split(':')[1]
              : 0;

            await this.redisService.set(key, serviceData, ttlTime);
          }
        }

        if (
          updateAppointmentServiceDto.type === 'end' ||
          updateAppointmentServiceDto.type === 'rollback-end'
        ) {
          const updateObj = {
            actual_end_time: new Date(),
          };

          if (updateAppointmentServiceDto.type === 'rollback-end') {
            updateObj.actual_end_time = null;
          }

          if (updateAppointmentServiceDto.extra_time) {
            updateObj['extra_time'] = updateAppointmentServiceDto.extra_time;
          }

          let whereObj = {};
          if (appointmentData.package_id) {
            whereObj = {
              package_id: appointmentData.package_id,
              exp_start_date: appointmentData.exp_start_date,
            };
          } else {
            whereObj = {
              id: updateAppointmentServiceDto.appointment_service_id,
            };
          }

          await this.appointmentServiceRepository.update(whereObj, updateObj);

          appointmentServices = await this.appointmentServiceRepository.find({
            appointment_id: appointmentData.appointment_id,
          });
        }

        if (updateAppointmentServiceDto.type === 'cancel') {
          const updateObj = {
            cancellation_reason:
              updateAppointmentServiceDto.cancellation_reason,
            cancellation_charge:
              updateAppointmentServiceDto.cancellation_charge,
          };

          let whereObj = {};
          if (appointmentData.package_id) {
            whereObj = {
              package_id: appointmentData.package_id,
              exp_start_date: appointmentData.exp_start_date,
            };
          } else {
            whereObj = {
              id: updateAppointmentServiceDto.appointment_service_id,
            };
          }

          await this.appointmentServiceRepository.update(whereObj, updateObj);
        }

        if (updateAppointmentServiceDto.type === 'extra_time') {
          const updateObj = {
            extra_time: updateAppointmentServiceDto.extra_time,
          };

          let whereObj = {};
          if (appointmentData.package_id) {
            whereObj = {
              package_id: appointmentData.package_id,
              exp_start_date: appointmentData.exp_start_date,
            };
          } else {
            whereObj = {
              id: updateAppointmentServiceDto.appointment_service_id,
            };
          }

          await this.appointmentServiceRepository.update(whereObj, updateObj);
        }

        const new_service = [];
        // diffrentiate between package and service
        for (const ap of appointmentServices) {
          if (ap.package_id) {
            const found = new_service.find(
              (s) =>
                s.package_id === ap.package_id &&
                s.exp_start_date.toString() === ap.exp_start_date.toString(),
            );
            if (!found) {
              new_service.push(ap);
            }
          } else {
            new_service.push(ap);
          }
        }
        // fetch all started services
        const startedService = new_service.filter((ap) => ap.actual_start_time);

        response['start_service'] = startedService.length;

        // fetch all completed services
        const completedService = new_service.filter((ap) => ap.actual_end_time);

        response['end_service'] = completedService.length;

        response['total_services'] = new_service.length;

        if (updateAppointmentServiceDto.type === 'start') {
          if (startedService.length <= new_service.length) {
            await this.appointmentRepository.update(
              {
                id: appointmentData.appointment_id,
              },
              {
                status: 'ongoing',
              },
            );
          }
        }

        if (
          updateAppointmentServiceDto.type === 'rollback-start' &&
          startedService.length === 0
        ) {
          await this.appointmentRepository.update(
            {
              id: appointmentData.appointment_id,
            },
            {
              status: 'checked_in',
            },
          );
        }

        if (updateAppointmentServiceDto.type === 'end') {
          // CHECK:: commentedv because of AC 2782: 'After stopping of all services, appointment should stay in On Going status, until user has paid for the service he has taken.'
          // if (completedService.length === appointmentServices.length) {
          //   await this.appointmentRepository.update(
          //     {
          //       id: appointmentData.appointment_id,
          //     },
          //     {
          //       status: 'completed',
          //     },
          //   );
          // }
        }

        const [appointmentObj] = await this.appointmentRepository.find({
          id: appointmentData.appointment_id,
        });

        response['status'] = appointmentObj?.status;

        this.logger.info(
          `AppointmentsService : Exit appointmentServiceUpdate Method`,
        );
        this.ECSlogger.info(
          `AppointmentsService : Exit appointmentServiceUpdate Method`,
        );

        return {
          response,
          message: 'Appointment service updated successfully.',
        };
      } else {
        throw new Error('Appointment service not found.');
      }
    } catch (error) {
      this.logger.error(
        `AppointmentsService : ERROR in catch block appointmentServiceUpdate Method`,
      );
      this.ECSlogger.error(
        `AppointmentsService : ERROR in catch block appointmentServiceUpdate Method`,
      );
      throw error;
    }
  }

  async addServiceToExistingAppoingment(
    addServiceDto: AddToCartDto,
    customer_id: string,
    tenant_id: string,
    guest_user_id: string,
    headers: any,
  ) {
    try {
      this.logger.info(
        `AppointmentsService : Enter addServiceToExistingAppoingment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsService : Enter addServiceToExistingAppoingment Method`,
      );

      const [appointmentData] = await this.appointmentRepository.find({
        id: addServiceDto.appointment_id,
      });

      if (appointmentData) {
        // if ((appointmentData?.status !== 'completed' || appointmentData?.status !== 'checked_in')) {
        //   throw new Error('You can add service only in completed or checked in appointment')
        // }

        // If booking is done by preferred by saloon then assign random cutter (first match)
        if (!addServiceDto.cutter_id) {
          const time_from = new Date(addServiceDto.time_from);
          const time_to = new Date(addServiceDto.time_to);
          const timeDifference = this.getTimeDifference(time_to, time_from);
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
          const reqObj: any = {
            store_id: addServiceDto.store_id,
            date: onlyDate,
            service_duration: timeDifference,
            req_type: 'choose_cutter',
          };

          const cuttersAvailableSlots: any =
            await this.checkingCutteravailabilityByCutter(
              reqObj,
              headers['domain_name'],
              null,
              headers['tenant_id'],
            );
          let matchCutterId = '';
          let matchCutterStatus = null;
          let cutter_name = '';
          let matchCutterProfileImage = '';
          let foundCutter = false;
          for (let i = 0; i < cuttersAvailableSlots.length; i++) {
            for (
              let j = 0;
              j < cuttersAvailableSlots[i].cutter_availability.length;
              j++
            ) {
              if (
                cuttersAvailableSlots[i].cutter_availability[j].time_from ===
                  addServiceDto.time_from &&
                cuttersAvailableSlots[i].cutter_availability[j].time_to ===
                  addServiceDto.time_to
              ) {
                matchCutterId = cuttersAvailableSlots[i].employee_user_id;
                cutter_name = `${cuttersAvailableSlots[i]?.firstname} ${cuttersAvailableSlots[i]?.lastname}`;
                matchCutterStatus = cuttersAvailableSlots[i].status;
                matchCutterProfileImage =
                  cuttersAvailableSlots[i].presigned_url;
                foundCutter = true;
                break;
              }
            }
            if (foundCutter) {
              break;
            }
          }
          if (!matchCutterId) {
            throw new Error('Cutter is not available in this time duration');
          }

          if (matchCutterStatus !== 'active') {
            throw new Error("You can't book inactive cutters");
          }

          addServiceDto['cutter_id'] = matchCutterId;
          addServiceDto['cutter_name'] = cutter_name;
          addServiceDto['cutter_profile_image'] = matchCutterProfileImage || '';
          addServiceDto['is_cutter_assigned'] = 1;
        } else {
          addServiceDto['is_cutter_assigned'] = 0;
        }

        const query = `SELECT * from appointment_service_booked WHERE 
      
          (( exp_start_date >= '${moment(addServiceDto.time_from).format(
            Constant.DATE_FORMAT.YMD_HMD,
          )}' AND exp_end_date <= '${moment(addServiceDto.time_to).format(
          Constant.DATE_FORMAT.YMD_HMD,
        )}' ) OR
          
          ( exp_end_date > '${moment(addServiceDto.time_from).format(
            Constant.DATE_FORMAT.YMD_HMD,
          )}' AND exp_start_date < '${moment(addServiceDto.time_to).format(
          Constant.DATE_FORMAT.YMD_HMD,
        )}' ))

          AND cutter_id = '${
            addServiceDto.cutter_id
          }' AND tenant_id = '${tenant_id}'`;

        const bookedSlot = await this.appointmentServiceRepository.query(query);

        if (bookedSlot && bookedSlot.length) {
          throw new Error('Cutter already booked in this time duration');
        }

        let appointment_query = `SELECT * from appointment_appointment WHERE 
        (( appointment_time >= '${moment(addServiceDto.time_from).format(
          Constant.DATE_FORMAT.YMD_HMD,
        )}' AND appointment_end_time <= '${moment(addServiceDto.time_to).format(
          Constant.DATE_FORMAT.YMD_HMD,
        )}' ) OR
        
        ( appointment_end_time > '${moment(addServiceDto.time_from).format(
          Constant.DATE_FORMAT.YMD_HMD,
        )}' AND appointment_time < '${moment(addServiceDto.time_to).format(
          Constant.DATE_FORMAT.YMD_HMD,
        )}' ))
         AND tenant_id = '${tenant_id}'`;

        if (customer_id && customer_id != 'null') {
          appointment_query += ` AND client_id = '${customer_id}'`;
        }

        if (guest_user_id && guest_user_id != 'null') {
          appointment_query += ` AND guest_user_id = '${guest_user_id}'`;
        }

        const bookedAppointments = await this.appointmentRepository.query(
          appointment_query,
        );

        if (bookedAppointments && bookedAppointments.length) {
          throw new Error('you have already booked this time slot');
        }

        const objToSave: any = {
          tenant_id: tenant_id || '',
          appointment_id: addServiceDto.appointment_id,
          service_id: addServiceDto.service_id,
          exp_start_date: moment(addServiceDto.time_from).format(
            Constant.DATE_FORMAT.YMD_HMD,
          ),
          exp_end_date: moment(addServiceDto.time_to).format(
            Constant.DATE_FORMAT.YMD_HMD,
          ),
          cutter_id: addServiceDto.cutter_id,
          price: +addServiceDto.price,
          tax: 0,
          cutter_note: addServiceDto.cutter_note || '',
          created_by: customer_id,
          store_id: addServiceDto.store_id || '',
          discount: addServiceDto.discount || null,
          guest_name: addServiceDto.guest_name || null,
          package_id: addServiceDto.package_id || null,
          service_option_id: addServiceDto.service_option_id || null,
          service_option_name: addServiceDto.service_option_name || null,
          service_option_price: addServiceDto.service_option_price || null,
          is_cutter_assigned: addServiceDto['is_cutter_assigned'],
          service_or_package_name: addServiceDto.name || '',
          approx_time: addServiceDto.approx_time || 0,
        };

        if (addServiceDto.package_id) {
          for (let i = 0; i < addServiceDto.service_id.length; i++) {
            objToSave['service_id'] = addServiceDto.service_id[i]['id'];
            objToSave['service_price'] = addServiceDto.service_id[i]['price'];
            objToSave['service_discount'] =
              addServiceDto.service_id[i]['discount'] || 0;
            objToSave['service_discounted_price'] =
              addServiceDto.service_id[i]['discounted_price'] || 0;
            objToSave['service_name'] =
              addServiceDto.service_id[i]['name'] || '';
            await this.appointmentServiceRepository.save(
              AppointmentServiceDto.toEntity(objToSave),
            );
          }
        } else {
          objToSave['service_id'] = addServiceDto.service_id;

          await this.appointmentServiceRepository.save(
            AppointmentServiceDto.toEntity(objToSave),
          );
        }

        // EMIT rabbit MQ messgae if appointment status is checked-out
        // publish message to rabbitmq
        const publishObj = {
          appointment_id: appointmentData.id,
        };

        const queueName = `${process.env.MODE}_invoice_cancel_queue`;
        await this.cancelInvoiceRabitMQService.emitMqMessages(
          queueName,
          publishObj,
        );

        // Update status of appointment to ongoing
        await this.appointmentRepository.update(
          {
            id: addServiceDto.appointment_id,
          },
          {
            status: 'ongoing',
          },
        );

        this.logger.info(
          `AppointmentsService : Exit addServiceToExistingAppoingment Method`,
        );
        this.ECSlogger.info(
          `AppointmentsService : Exit addServiceToExistingAppoingment Method`,
        );
        return { message: 'Service added to appointment successfully.' };
      } else {
        throw new Error('Appointment not found');
      }
    } catch (error) {
      this.logger.error(
        `AppointmentsService : ERROR in catch block addServiceToExistingAppoingment Method`,
      );
      this.ECSlogger.error(
        `AppointmentsService : ERROR in catch block addServiceToExistingAppoingment Method`,
      );
      throw error;
    }
  }

  async addToWalkOut(walkOutDto: WalkOutDto) {
    try {
      this.logger.info(`AppointmentsService : Enter addToWalkOut Method`);
      this.ECSlogger.info(`AppointmentsService : Enter addToWalkOut Method`);
      // check store is open or not
      if (!walkOutDto.store_id) {
        throw new Error('Store is man');
      }
      const currentDay = new Date(walkOutDto.date).getDay();
      const dayName = Constant.WEEK_DAYS[currentDay];

      const [storeData] = await this.storeDetailRepository.query(`
        SELECT * FROM public.mv_stores where id = '${walkOutDto.store_id}' AND weekday = '${dayName}'
      `);

      if (!storeData?.store_open_time && !storeData?.store_end_time) {
        throw new Error('Store is closed for selected date');
      }

      const objToSave = {
        customer_name: walkOutDto.customer_name,
        cutter_id: walkOutDto.cutter_id,
        date: walkOutDto.date,
        time: walkOutDto.time,
        mobile: walkOutDto.mobile,
        is_guest: walkOutDto.is_guest,
      };

      for (const sid of walkOutDto.service_id) {
        objToSave['service_id'] = sid;
        await this.customerWalkoutRepository.save(
          WalkOutDto.toEntity(objToSave),
        );
      }

      this.logger.info(`AppointmentsService : Exit addToWalkOut Method`);
      this.ECSlogger.info(`AppointmentsService : Exit addToWalkOut Method`);
      return { message: 'Customer walk out detail added successfully.' };
    } catch (error) {
      throw error;
    }
  }

  async fetchEmployeeTodayAppointments(
    emp_user_id: string,
    date: string,
    paginationObj: any,
  ) {
    const appointmentDetails = [];
    const appointmentRecords = await this.storeDetailRepository
      .query(`select Distinct ON(appointment_id) asp.appointment_id, asp.exp_start_date date, aa.client_id as customer_id, 
      CONCAT(cu.first_name,' ',cu.last_name) as customer_name from appointment_service_booked asp LEFT JOIN appointment_appointment aa ON asp.appointment_id = aa.id 
      LEFT JOIN customer_user cu ON cu.id = aa.client_id
      where asp.cutter_id = '${emp_user_id}' and 
      (aa.appointment_time >= '${date} 00:00:00' AND aa.appointment_time < '${date} 23:59:59') ORDER BY appointment_id, date ASC LIMIT ${
      paginationObj.limit
    } OFFSET ${(paginationObj.skip - 1) * paginationObj.limit}`);
    const valueDetails = appointmentRecords;
    if (valueDetails && valueDetails.length > 0) {
      const serviceDetail = [];
      for (const value of valueDetails) {
        try {
          // Get services for each appointments
          const serviceDetails = await this.storeDetailRepository
            .query(`select ss.name, ss.id, ss.approx_time as duration, asp.exp_start_date, asp.exp_end_date, asp.actual_start_time, asp.actual_end_time from service_services ss LEFT JOIN appointment_service_booked asp ON ss.id = asp.service_id
          where asp.appointment_id = '${value.appointment_id}'`);
          if (serviceDetails && serviceDetails.length > 0) {
            for (const service of serviceDetails) {
              if (service.actual_start_time == null) {
                service['actual_start_time'] = '';
              }
              if (service.actual_end_time == null) {
                service['actual_end_time'] = '';
              }
              serviceDetail.push(service);
            }
          }
          value['service_details'] = serviceDetails;
        } catch (error) {
          return error.response;
        }
        appointmentDetails.push(value);
      }
    }
    const sortedTodayAppointment = appointmentDetails
      .slice()
      .sort((a, b) => a.date - b.date);
    return sortedTodayAppointment;
  }

  async fetchStoreEmployeeTodayAppointments(
    emp_user_id: string,
    date: string,
    paginationObj: any,
  ) {
    const appointmentDetails = [];
    const empDetails = await this.storeDetailRepository
      .query(`select eu.id, CONCAT(eu.firstname,' ',eu.lastname) employee_name, STRING_AGG(cs.name, ', ')as skills_set from employee_user eu 
    LEFT JOIN employee_skills es ON eu.id = es.employee_user_id LEFT JOIN config_skills cs ON cs.id = es.skill_id 
    where eu.id = '${emp_user_id}' GROUP BY eu.id`);
    const appointmentRecords = await this.storeDetailRepository
      .query(`select Distinct ON(appointment_id) asp.appointment_id, asp.exp_start_date date, aa.client_id as customer_id, 
      CONCAT(cu.first_name,' ',cu.last_name) as customer_name from appointment_service_booked asp LEFT JOIN appointment_appointment aa ON asp.appointment_id = aa.id 
      LEFT JOIN customer_user cu ON cu.id = aa.client_id
      where asp.cutter_id = '${emp_user_id}' and 
      (aa.appointment_time >= '${date} 00:00:00' AND aa.appointment_time < '${date} 23:59:59') ORDER BY appointment_id, date ASC LIMIT ${
      paginationObj.limit
    } OFFSET ${(paginationObj.skip - 1) * paginationObj.limit}`);
    const valueDetails = appointmentRecords;
    if (valueDetails && valueDetails.length > 0) {
      const serviceDetail = [];
      for (const value of valueDetails) {
        try {
          // Get services for each appointments
          const serviceDetails = await this.storeDetailRepository
            .query(`select ss.name, ss.id, ss.approx_time as duration, asp.exp_start_date, asp.exp_end_date, asp.actual_start_time, asp.actual_end_time from service_services ss LEFT JOIN appointment_service_booked asp ON ss.id = asp.service_id
          where asp.appointment_id = '${value.appointment_id}'`);
          if (serviceDetails && serviceDetails.length > 0) {
            for (const service of serviceDetails) {
              if (service.actual_start_time == null) {
                service['actual_start_time'] = '';
              }
              if (service.actual_end_time == null) {
                service['actual_end_time'] = '';
              }
              serviceDetail.push(service);
            }
          }
          value['service_details'] = serviceDetails;
        } catch (error) {
          return error.response;
        }
        appointmentDetails.push(value);
      }
    }
    const sortedTodayAppointment = appointmentDetails
      .slice()
      .sort((a, b) => a.date - b.date);
    return {
      sortedTodayAppointment: sortedTodayAppointment,
      employee_details: empDetails,
    };
  }

  async getServiceDetails(getServiceDto: GetServiceDto) {
    try {
      if (getServiceDto && getServiceDto.services_id.length > 0) {
        const serviceIds = getServiceDto.services_id;
        const serviceIdValue = serviceIds.join("', '");
        const getServiceIds = await this.serviceRepository.query(
          `select Distinct(service_id), price from mv_services where 
        service_id IN('${serviceIdValue}')`,
        );
        return {
          details: getServiceIds,
          message: 'Service details are fetched successfully.',
        };
      } else {
        return { message: 'Please provide service id.' };
      }
    } catch (error) {
      throw error;
    }
  }

  async findAllAWSSecretsManager(domain_name: string) {
    try {
      return await this.utilityService.upAWSSecrets(domain_name);
    } catch (error) {
      throw error;
    }
  }

  async getAppoinmentCutterWise(req: any) {
    try {
      this.logger.info(
        `AppointmentsService : Enter getAppoinmentCutterWise Method`,
      );
      this.ECSlogger.info(
        `AppointmentsService : Enter getAppoinmentCutterWise Method`,
      );

      let where = '';

      if (req?.query?.date) {
        where += `exp_start_date >= '${req.query.date} 00:00:00' AND exp_end_date <= '${req.query.date} 23:59:59'`;
      } else {
        throw new Error('Date is compulsory');
      }

      let storeOpenHours;
      if (req?.query?.store_id) {
        where += ` AND store_id = '${req.query.store_id}'`;

        // get store shift time in hours
        const currentDay = new Date(req?.query?.date).getDay();
        const dayName = Constant.WEEK_DAYS[currentDay];

        const storeShiftQuery = `
          with store_hours AS ( 
            select DISTINCT ON (weekday, store_open_time) store_open_time, store_end_time,
              date_part('hour',concat('2021-01-01 ',store_end_time)::timestamp - concat('2021-01-01 ',store_open_time)::timestamp) as hours,
              date_part('minutes',concat('2021-01-01 ',store_end_time)::timestamp - concat('2021-01-01 ',store_open_time)::timestamp) as minutes
              from mv_stores where id = '${req?.query?.store_id}' AND weekday = '${dayName}'
          )
          select 
            sum(hours * 60 + minutes) / 60 as hours
          from store_hours where hours >= 0 and minutes >= 0
        `;

        const [storeShiftData] = await this.storeDetailRepository.query(
          storeShiftQuery,
        );
        storeOpenHours = storeShiftData?.hours || 0;
      }

      // TODO:: delet this Temparory code
      const { startDate, endDate } = await this.getStoreOpenCloseTime(
        req.query.store_id,
        req.query.date,
      );

      const query = `SELECT
          cutter_id, JSON_AGG(appointment_id) as appointment_ids
          FROM appointment_service_booked WHERE ${where} group by cutter_id`;

      const result = await this.appointmentServiceRepository.query(query);

      const cutterIds = [];
      const allAppointments = [];
      if (result?.length) {
        for (const [index, cutter] of result.entries()) {
          cutterIds.push(cutter.cutter_id);
          if (cutter.appointment_ids?.length) {
            let appointments = await this.appointmentRepository.find({
              relations: ['service_booked'],
              where: {
                id: In(cutter.appointment_ids),
              },
            });

            appointments = appointments.filter((app) => {
              return (
                Constant.appointment_status.indexOf(app.status) >= 0
                // &&
                // new Date(app.appointment_time) >= new Date(startDate) &&
                // new Date(app.appointment_end_time) <= new Date(endDate)
              );
            });

            // allAppointments.push(...appointments);

            appointments = await this.getAppoinmentServiceDetail(
              appointments,
              req['headers']['domain_name'],
              null,
              req['headers']['tenant_id'],
            );

            // merge all service_booked arrays
            const services = [];
            for (const app of appointments) {
              // calculate to display the checkout button or not
              const completeServices = app.service_booked.filter(
                (service) => service.actual_end_time,
              );

              const display_checkout =
                app.service_booked.length === completeServices.length
                  ? true
                  : false;

              for (const app_service of app.service_booked) {
                if (app_service && app_service.cutter_id === cutter.cutter_id) {
                  app_service['display_checkout'] = display_checkout;

                  // TODO:: Assign missing parameters of appointment object here
                  app_service['status'] = app.status;
                  app_service['customer_name'] = app['customer_name'];
                  app_service['customer_profile'] = app['customer_profile'];
                  app_service['is_new_user'] = app['is_new_user'];
                  app_service['customer_dob'] = app['customer_dob'];
                  app_service['client_id'] = app['client_id'];
                  app_service['invoice_id'] = app['invoice_id'];
                  app_service['invoice_status'] = app['invoice_status'];
                  app_service['payment_status'] = app['payment_status'];
                  app_service['is_cancelled'] = app['is_cancelled'];
                  app_service['appointment_uniq_id'] =
                    app['appointment_uniq_id'];
                  app_service['cancellation_reason'] =
                    app['cancellation_reason'];
                  const appointment_services = [];
                  for (const appointment_service of app.service_booked) {
                    if (
                      appointment_service &&
                      appointment_service.cutter_id === cutter.cutter_id
                    ) {
                      appointment_services.push({
                        cutter_id: appointment_service.cutter_id,
                        appointment_id: appointment_service.appointment_id,
                        store_id: appointment_service.store_id,
                        service_id: appointment_service.service_id,
                        approx_time: appointment_service.approx_time,
                        name: appointment_service['name'],
                        service_or_package_name:
                          appointment_service.service_or_package_name,
                        cutter_name: appointment_service['cutter_name'],
                        exp_start_date: appointment_service.exp_start_date,
                        exp_end_date: appointment_service.exp_end_date,
                        service_option_id:
                          appointment_service.service_option_id,
                        service_option_name:
                          appointment_service.service_option_name,
                        service_option_price:
                          appointment_service.service_option_price,
                        service_option_duration:
                          appointment_service.service_option_duration,
                        service_option_status:
                          appointment_service['service_option_status'],
                        cutter_note: appointment_service.cutter_note,
                      });
                    }
                  }
                  app_service['appointment_services'] = appointment_services;
                  services.push(app_service);
                }
              }
            }

            services.sort(function (x, y) {
              if (new Date(x.exp_start_date) > new Date(y.exp_start_date)) {
                return 1;
              }
              if (new Date(x.exp_start_date) < new Date(y.exp_start_date)) {
                return -1;
              }
              return 0;
            });

            cutter.appointments = services;
            allAppointments.push(...services);

            const { bookedMinutes } = await this.calculateBookedHours(
              appointments,
            );
            cutter.booked_hours = bookedMinutes;

            delete cutter.appointment_ids;

            const cutterObj = await this.getCutterData(
              cutter.cutter_id,
              req?.query?.date,
              req['headers']['tenant_id'],
            );
            cutterObj['scheduled_hours'] =
              storeOpenHours > 0
                ? Math.min(cutterObj['scheduled_hours'], storeOpenHours)
                : cutterObj['scheduled_hours'];
            result[index] = { ...cutter, ...cutterObj };
          }
        }
      }

      const allAppointmentsObj = {};
      // const appointmentQuery = `
      //     SELECT * FROM appointment_appointment WHERE appointment_time >= '${req.query.date} 00:00:00' AND appointment_time <= '${req.query.date} 23:59:59';
      //   `;

      // const appointmentResult = await this.appointmentRepository.query(
      //   appointmentQuery,
      // );

      // fetch other cutters for whom not a single apppointment is booked - amp-7718
      let cutterQuery = `SELECT DISTINCT on (employee_user_id, shift_start_time, shift_type)
          image as cutter_presigned_url,
          employee_user_id,
          employee_user_id as cutter_id,
          shift_type,
          shift_start_time,
          shift_end_time,
          cutter_name
            FROM mv_cutter_schedule mvc
            WHERE
              mvc.store_id = '${req.query.store_id}'
              AND (
                (mvc.shift_start_time >= '${req.query.date} 00:00:00' AND mvc.shift_end_time > '${req.query.date} 00:00:00')
                OR
                ('${req.query.date} 00:00:00' >= mvc.shift_start_time AND '${req.query.date} 00:00:00' <= mvc.shift_end_time)
              ) AND mvc.shift_end_time <= '${req.query.date} 23:59:59' AND mvc.status = 'active' AND mvc.is_deleted = false AND mvc.shift_status = 'active'`;

      if (cutterIds?.length) {
        cutterQuery += ` AND employee_user_id NOT IN (${
          "'" + cutterIds?.join("','") + "'"
        })`;
      }

      const otherCutters = await this.cutterScheduleRepository.query(
        cutterQuery,
      );

      const cuttersWithoutAppointment = {};
      if (otherCutters?.length) {
        for (const cutter of otherCutters) {
          if (!cuttersWithoutAppointment[cutter.cutter_id]) {
            const cutterObj = await this.getCutterData(
              cutter.cutter_id,
              req?.query?.date,
              req['headers']['tenant_id'],
            );

            cuttersWithoutAppointment[cutter.cutter_id] = {
              cutter_id: cutter.cutter_id,
              appointments: [],
              booked_hours: 0,
              cutter_name: cutter.cutter_name,
              scheduled_hours:
                storeOpenHours > 0
                  ? Math.min(cutterObj['scheduled_hours'], storeOpenHours)
                  : cutterObj['scheduled_hours'],
            };
          }
        }
      }
      const upcoming = [];
      const checked_in = [];
      const ongoing = [];
      const completed = [];
      const pending = [];

      // TODO:: comment the date condition while fetching the upcoming appointment
      allAppointments.map((app) => {
        if (
          // new Date(app.appointment_time) > new Date() &&
          app.status === 'booked' ||
          app.status === 'rescheduled'
        ) {
          upcoming.push(app);
        }

        if (app.status === 'checked_in') {
          checked_in.push(app);
        }

        if (app.status === 'pending') {
          pending.push(app);
        }

        if (app.status === 'ongoing' || app.status === 'checked_out') {
          ongoing.push(app);
        }

        if (app.status === 'completed') {
          completed.push(app);
        }
      });
      allAppointmentsObj['upcoming'] = upcoming.length;
      allAppointmentsObj['checked_in'] = checked_in.length;
      allAppointmentsObj['ongoing'] = ongoing.length;
      allAppointmentsObj['completed'] = completed.length;
      allAppointmentsObj['pending'] = pending.length;

      this.logger.info(
        `AppointmentsService : Exit getAppoinmentCutterWise Method`,
      );
      this.ECSlogger.info(
        `AppointmentsService : Exit getAppoinmentCutterWise Method`,
      );

      return {
        allAppointmentsObj,
        appointments: [...result, ...Object.values(cuttersWithoutAppointment)],
      };
    } catch (error) {
      throw error;
    }
  }

  async getTtlOfAppointmentService(appointmet_service_id: string) {
    try {
      this.logger.info(
        `AppointmentsService : Enter getTtlOfAppointmentService Method`,
      );
      this.ECSlogger.info(
        `AppointmentsService : Enter getTtlOfAppointmentService Method`,
      );

      const key = Constant.REDIS.service_key + appointmet_service_id;
      const ttl_time = await this.redisService.getTtl(key);
      this.logger.info(
        `AppointmentsService : Exit getTtlOfAppointmentService Method`,
      );
      this.ECSlogger.info(
        `AppointmentsService : Exit getTtlOfAppointmentService Method`,
      );

      return { ttl_time: ttl_time > 0 ? ttl_time : 0 };
    } catch (error) {
      throw error;
    }
  }

  async getAppoinmentEmployeeWise(req: any) {
    try {
      this.logger.info(
        `AppointmentsService : Enter getAppoinmentEmployeeWise Method`,
      );
      this.ECSlogger.info(
        `AppointmentsService : Enter getAppoinmentEmployeeWise Method`,
      );

      let where = '';

      if (req?.query?.date) {
        where += `exp_start_date >= '${req.query.date} 00:00:00' AND exp_end_date <= '${req.query.date} 23:59:59'`;
      } else {
        throw new Error('Date is compulsory');
      }

      if (req?.query?.cutter_id) {
        where += ` AND cutter_id = '${req.query.cutter_id}'`;
      } else {
        throw new Error('Cutter id is compulsory');
      }

      const query = `SELECT
          cutter_id, JSON_AGG(DISTINCT appointment_id) as appointment_ids, JSON_AGG(DISTINCT store_id) as store_id
          FROM appointment_service_booked WHERE ${where} group by cutter_id`;

      const [result] = await this.appointmentServiceRepository.query(query);

      const store_details = [];
      // get store Data
      if (result?.store_id?.length) {
        const storeQuery = `select
        JSON_AGG(json_build_object('id', id, 'name', name, 'store_open_time', store_open_time, 'store_end_time', store_end_time)) as stores
        from mv_stores where id IN (${"'" + result?.store_id.join("','") + "'"})
        group by id`;

        const storeResult = await this.storeDetailRepository.query(storeQuery);
        if (storeResult.length) {
          for (const st of storeResult) {
            store_details.push(st.stores[0]);
          }
        }
      }

      let selected_store = null;

      if (!req?.query?.store_id) {
        selected_store = store_details[0];
        req.query.store_id = store_details[0].id;
      } else if (req?.query?.store_id.toLowerCase() !== 'all') {
        selected_store = store_details.find(
          (s) => s.id === req?.query?.store_id,
        );
      }

      const allAppointments = [];
      if (result) {
        // for (const [index, cutter] of result.entries()) {
        if (result.appointment_ids?.length) {
          let appointments = await this.appointmentRepository.find({
            relations: ['service_booked'],
            where: {
              id: In(result.appointment_ids),
            },
          });

          appointments = appointments.filter((app) => {
            if (Constant.appointment_status.indexOf(app.status) >= 0) {
              // app['store_id'] = app.service_booked.length ? app.service_booked[0].store_id : null;
              if (
                !req?.query?.store_id ||
                req?.query?.store_id.toLowerCase() === 'all'
              ) {
                return true;
              } else {
                const found = app.service_booked.find(
                  (as) => as.store_id === req?.query?.store_id,
                );
                if (found) {
                  return true;
                }
              }
            }
          });

          allAppointments.push(...appointments);

          appointments = await this.getAppoinmentServiceDetail(
            appointments,
            req['headers']['domain_name'],
            null,
            req['headers']['tenant_id'],
          );
          result.appointments = appointments;

          delete result.appointment_ids;
          delete result.store_id;
        }
        // }
      }

      const allAppointmentsObj = {};

      let upcoming = [];
      let ongoing = [];
      let completed = [];

      // TODO:: comment the date condition while fetching the upcoming appointment
      allAppointments.forEach((app) => {
        if (
          // new Date(app.appointment_time) > new Date() &&
          app.status === 'booked'
          // || app.status === 'checked_in')
        ) {
          upcoming.push(app);
        }

        // if (app.status === 'checked_in') {
        //   checked_in.push(app)
        // }

        if (app.status === 'ongoing' || app.status === 'checked_out') {
          ongoing.push(app);
        }

        if (app.status === 'completed') {
          completed.push(app);
        }
      });
      allAppointmentsObj['upcoming'] = upcoming.length;
      // allAppointmentsObj['checked_in'] = checked_in.length;
      allAppointmentsObj['ongoing'] = ongoing.length;
      allAppointmentsObj['completed'] = completed.length;

      // if store_id == 'all' then make app object based on store array
      if (req?.query?.store_id.toLowerCase() === 'all') {
        upcoming = Object.values(
          upcoming.reduce((acc, obj) => {
            if (acc[obj.store_id]) {
              acc[obj.store_id].appointments.push(obj);
              return acc;
            } else {
              acc[obj.store_id] = {
                store_name: obj.store_name,
                store_open_time: obj.store_open_time,
                store_end_time: obj.store_end_time,
                appointments: [obj],
              };
              return acc;
            }
          }, {}),
        );

        ongoing = Object.values(
          ongoing.reduce((acc, obj) => {
            if (acc[obj.store_id]) {
              acc[obj.store_id].appointments.push(obj);
              return acc;
            } else {
              acc[obj.store_id] = {
                store_name: obj.store_name,
                store_open_time: obj.store_open_time,
                store_end_time: obj.store_end_time,
                appointments: [obj],
              };
              return acc;
            }
          }, {}),
        );

        completed = Object.values(
          completed.reduce((acc, obj) => {
            if (acc[obj.store_id]) {
              acc[obj.store_id].appointments.push(obj);
              return acc;
            } else {
              acc[obj.store_id] = {
                store_name: obj.store_name,
                store_open_time: obj.store_open_time,
                store_end_time: obj.store_end_time,
                appointments: [obj],
              };
              return acc;
            }
          }, {}),
        );
      }

      // fetch the first date of the appointment
      const app_query = await this.appointmentServiceRepository.find({
        where: {
          cutter_id: req.query.cutter_id,
        },
        order: { exp_start_date: 'ASC' },
      });

      this.logger.info(
        `AppointmentsService : Exit getAppoinmentEmployeeWise Method`,
      );
      this.ECSlogger.info(
        `AppointmentsService : Exit getAppoinmentEmployeeWise Method`,
      );

      return {
        allAppointmentsObj,
        upcoming_appointment: upcoming,
        ongoing_appointment: ongoing,
        completed_apopintment: completed,
        store_details: store_details,
        selected_store,
        first_appointment_date: app_query?.length
          ? this.removeTimeZone(app_query[0].exp_start_date)
          : null,
      };
    } catch (error) {
      throw error;
    }
  }

  async getCuttersAppointment(req: any) {
    try {
      this.logger.info(
        `AppointmentsService : Enter getCuttersAppointment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsService : Enter getCuttersAppointment Method`,
      );

      const response = {
        all_appointments: {
          upcoming: 0,
          total_appointment: 0,
        },
        cutter_profile: {
          cutter_name: '',
          cutter_profile_image: '',
          skill: '',
          shift_start_time: '',
          shift_end_time: '',
          booked_hours: 0,
          income: 0,
          shifts: [],
          offTime: [],
        },
        appointments: [],
      };

      let where = '';

      if (req?.query?.date) {
        where += `exp_start_date >= '${req.query.date} 00:00:00' AND exp_end_date <= '${req.query.date} 23:59:59'`;
      } else {
        throw new Error('Date is compulsory');
      }

      if (req?.params?.cutter_id) {
        where += ` AND cutter_id = '${req.params.cutter_id}'`;
      } else {
        throw new Error('Cutter id is compulsory');
      }

      if (req?.query?.store_id) {
        where += ` AND store_id = '${req.query.store_id}'`;
      } else {
        throw new Error('Query paramter is missing: store_id');
      }

      const configObj = await this.getFranchisorConfig(req?.headers?.tenant_id);

      const query = `SELECT
          cutter_id, JSON_AGG(DISTINCT appointment_id) as appointment_ids, JSON_AGG(DISTINCT store_id) as store_id
          FROM appointment_service_booked WHERE ${where} group by cutter_id`;

      const [result] = await this.appointmentServiceRepository.query(query);

      const allAppointments = [];
      if (result) {
        if (result.appointment_ids?.length) {
          let appointments = await this.appointmentRepository.find({
            relations: ['service_booked'],
            where: {
              id: In(result.appointment_ids),
            },
          });

          appointments = appointments.filter((app) => {
            return Constant.appointment_status.indexOf(app.status) >= 0;
          });

          appointments = await this.getAppoinmentServiceDetail(
            appointments,
            req['headers']['domain_name'],
            null,
            req['headers']['tenant_id'],
          );
          result.appointments = appointments;
          allAppointments.push(...appointments);
        }
      }

      response['appointments'] = result?.appointments || [];

      const upcoming = [];
      allAppointments.forEach((app) => {
        if (
          // new Date(app.appointment_time) > new Date() &&
          app.status === 'booked' ||
          app.status === 'rescheduled'
          // app.status !== 'checked_in'
        ) {
          upcoming.push(app);
        }
      });

      response['all_appointments']['upcoming'] = upcoming.length;
      response['all_appointments']['total_appointment'] =
        response['appointments'].length;

      // cutter profile object
      const startDate = `${req.query.date} 00:00:00`;
      const endDate = `${req.query.date} 23:59:59`;
      const cutterData = await this.cutterScheduleRepository.query(
        `SELECT * FROM public.mv_cutter_schedule where employee_user_id = '${req?.params?.cutter_id}'
          AND store_id = '${req.query.store_id}'
          ORDER BY shift_start_time ASC`,
      );
      if (cutterData?.length) {
        response['cutter_profile'][
          'cutter_name'
        ] = `${cutterData[0]?.firstname} ${cutterData[0]?.lastname}`;
        if (cutterData[0].image) {
          response['cutter_profile']['cutter_profile_image'] =
            cutterData[0].image;
        } else {
          response['cutter_profile']['cutter_profile_image'] =
            configObj['default_cutter_image'];
        }

        // AND shift_start_time >= '${startDate}' AND shift_end_time <= '${endDate}'
        const filteredCutterData = cutterData.filter((cObj) => {
          return (
            new Date(cObj.shift_start_time) >= new Date(startDate) &&
            new Date(cObj.shift_end_time) <= new Date(endDate)
          );
        });
        const speciality = cutterData.reduce((acc, obj) => {
          if (acc?.length) {
            if (acc.indexOf(obj.speciality) === -1) {
              acc.push(obj.speciality);
            }
            return acc;
          } else {
            acc = [obj.speciality];
            return acc;
          }
        }, []);

        const shiftCutterData = filteredCutterData.reduce((acc, obj) => {
          if (obj.shift_type === 'shift') {
            if (acc?.length) {
              if (
                !acc.find(
                  (ac) =>
                    ac.shift_start_time.toString() ===
                    obj.shift_start_time.toString(),
                )
              ) {
                acc.push(obj);
                return acc;
              }
            } else {
              acc = [obj];
              return acc;
            }
          }
          return acc;
        }, []);

        response['cutter_profile']['skill'] = speciality?.length
          ? speciality.join(',')
          : '';
        response['cutter_profile']['shift_start_time'] =
          filteredCutterData?.length
            ? await this.removeTimeZone(filteredCutterData[0]?.shift_start_time)
            : '';
        response['cutter_profile']['shift_end_time'] =
          filteredCutterData?.length
            ? await this.removeTimeZone(filteredCutterData[0]?.shift_end_time)
            : '';

        // calculate booked hours and income
        const { bookedHours } = await this.calculateBookedHours(
          response['appointments'],
        );

        let totalHours = 0;

        for (const scd of shiftCutterData) {
          totalHours += +scd.number_of_hours;
          response['cutter_profile']['shifts'].push({
            shift_start_time: await this.removeTimeZone(scd.shift_start_time),
            shift_end_time: await this.removeTimeZone(scd.shift_end_time),
          });
        }

        totalHours = totalHours || 1;
        const bookedPercentage = +bookedHours
          ? Math.round((+bookedHours / +totalHours) * 100)
          : 0;
        response['cutter_profile']['booked_hours'] = bookedPercentage;
        response['cutter_profile']['income'] = +(
          +bookedHours * cutterData[0].billing_rate
        ).toFixed(2);

        // calculate off time for cutter
        const offTimeSchedule = filteredCutterData.filter(
          (c) => c.shift_type !== 'shift',
        );
        if (offTimeSchedule?.length) {
          const offTimeArray = [];
          for (const obj of offTimeSchedule) {
            const currentTime = await this.removeTimeZone(
              obj.shift_start_time,
            ).toString();
            if (
              !offTimeArray.find(
                (otObj) => otObj.shift_start_time.toString() === currentTime,
              )
            ) {
              offTimeArray.push({
                shift_start_time: await this.removeTimeZone(
                  obj.shift_start_time,
                ),
                shift_end_time: await this.removeTimeZone(obj.shift_end_time),
                cutter_status: obj.shift_type,
              });
            }
          }

          response['cutter_profile']['offTime'] = offTimeArray;
          response['appointments'] = [
            ...response['appointments'],
            ...offTimeArray,
          ];
        }
      }
      this.logger.info(
        `AppointmentsService : Exit getCuttersAppointment Method`,
      );
      this.ECSlogger.info(
        `AppointmentsService : Exit getCuttersAppointment Method`,
      );

      return response;
    } catch (error) {
      throw error;
    }
  }

  async sendMessage(createSendMessageDto: CreateSendMessageDto) {
    // publish messsge to rabbitmq
    this.rabbitMQService.emitMqMessages('send_message', createSendMessageDto);
    return true;
  }

  // ********************************************
  // ╔═╗╦═╗╦╦  ╦╔═╗╔╦╗╔═╗  ╔╦╗╔═╗╔╦╗╦ ╦╔═╗╔╦╗╔═╗
  // ╠═╝╠╦╝║╚╗╔╝╠═╣ ║ ║╣   ║║║║╣  ║ ╠═╣║ ║ ║║╚═╗
  // ╩  ╩╚═╩ ╚╝ ╩ ╩ ╩ ╚═╝  ╩ ╩╚═╝ ╩ ╩ ╩╚═╝═╩╝╚═╝
  // ********************************************

  private async timeSlots(
    service_duration,
    booked,
    availability,
    req_type,
    customer_id,
  ) {
    this.logger.info(`AppointmentsService : Enter timeSlots Method`);
    this.ECSlogger.info(`AppointmentsService : Enter timeSlots Method`);
    const booked_arr = [];
    const available_arr = [];
    let available_slots = [];
    for (let i = 0; i < availability.length; i++) {
      const start = availability[i].shift_start_time;
      const end = availability[i].shift_end_time;
      const slots = await this.generateSlots(
        start,
        end,
        service_duration,
        null,
      );
      slots.map((ele) => {
        available_arr.push(ele);
      });
    }
    for (let j = 0; j < booked.length; j++) {
      const start = booked[j].time_from
        ? booked[j].time_from
        : booked[j].exp_start_date;
      const end = booked[j].time_to
        ? booked[j].time_to
        : booked[j].exp_end_date;
      let slots;
      const booked_customer_id = booked[j].customer_id
        ? booked[j].customer_id
        : '';
      if (req_type === 'choose_cutter' && customer_id === booked_customer_id) {
        slots = await this.generateSlots(
          start,
          end,
          service_duration,
          booked[j],
        );
      } else {
        slots = await this.generateSlots(
          start,
          end,
          service_duration,
          booked[j],
        );
      }
      slots.map((ele) => {
        booked_arr.push(ele);
      });
    }
    if (booked_arr && booked_arr.length > 0) {
      available_slots = await this.filterSlots(booked_arr, available_arr);
    } else {
      available_slots = available_arr;
    }
    this.logger.info(`AppointmentsService : Exit timeSlots Method`);
    this.ECSlogger.info(`AppointmentsService : Exit timeSlots Method`);
    return available_slots;
  }

  private async generateSlots(start, end, slot, bookedData) {
    this.logger.info(`AppointmentsService : Enter generateSlots Method`);
    this.ECSlogger.info(`AppointmentsService : Enter generateSlots Method`);
    let start_time = new Date(start).valueOf();
    const end_time = new Date(end).valueOf();
    const slot_time = slot * 60 * 1000;
    const arr = [];
    // JAY - = for 8423
    if (end_time - start_time >= slot_time) {
      while (end_time - start_time >= slot_time) {
        // const startDate = new Date(new Date(start_time).toISOString().split('.')[0]).toISOString().split('.')[0];
        const startDate = new Date(start_time).toISOString().split('.')[0];
        // const endDate = new Date(new Date(start_time + slot_time).toISOString().split('.')[0]).toISOString().split('.')[0];
        const endDate = new Date(start_time + slot_time)
          .toISOString()
          .split('.')[0];
        const obj = {
          time_from: startDate,
          time_to: endDate,
        };
        if (bookedData) {
          obj['service_or_package_name'] = bookedData.name
            ? bookedData.name
            : bookedData.service_or_package_name;
          obj['guest_name'] = bookedData.guest_name;
        }
        arr.push(obj);
        start_time = start_time + slot_time;
      }
    } /*else {
      // const startDate = new Date(new Date(start_time).toISOString().split('.')[0]).toISOString().split('.')[0];
      const startDate = new Date(start_time).toISOString().split('.')[0];
      // const endDate = new Date(new Date(start_time + slot_time).toISOString().split('.')[0]).toISOString().split('.')[0];
      const endDate = new Date(start_time + slot_time)
        .toISOString()
        .split('.')[0];
      const obj = {
        time_from: startDate,
        time_to: endDate,
      };
      if (bookedData) {
        obj['service_or_package_name'] = bookedData.name
          ? bookedData.name
          : bookedData.service_or_package_name;
        obj['guest_name'] = bookedData.guest_name;
      }
      arr.push(obj);
    }*/
    this.logger.info(`AppointmentsService : Exit generateSlots Method`);
    this.ECSlogger.info(`AppointmentsService : Exit generateSlots Method`);
    return arr;
  }

  private async filterSlots(booked_arr, available_arr) {
    this.logger.info(`AppointmentsService : Enter filterSlots Method`);
    this.ECSlogger.info(`AppointmentsService : Enter filterSlots Method`);
    const final_arr = [];
    available_arr.map((ele) => {
      let count = 0;
      booked_arr.map((ele1) => {
        if (
          new Date(ele.time_from).getTime() ==
            new Date(ele1.time_from).getTime() &&
          new Date(ele.time_to).getTime() == new Date(ele1.time_to).getTime()
        ) {
          if (ele1.service_or_package_name) {
            ele['service_or_package_name'] = ele1.service_or_package_name;
            ele['guest_name'] = ele1.guest_name;
            final_arr.push(ele);
          }
          count++;
        }
      });
      if (count == 0) {
        final_arr.push(ele);
      }
    });
    this.logger.info(`AppointmentsService : Exit filterSlots Method`);
    this.ECSlogger.info(`AppointmentsService : Exit filterSlots Method`);
    return final_arr;
  }

  private async sortingTimestamp(arr) {
    this.logger.info(`AppointmentsService : Enter sortingTimestamp Method`);
    this.ECSlogger.info(`AppointmentsService : Enter sortingTimestamp Method`);
    arr = _.sortBy(arr, ['time_from']);
    arr = _.map(
      _.uniq(
        _.map(arr, function (obj) {
          return JSON.stringify(obj);
        }),
      ),
      function (obj) {
        return JSON.parse(obj);
      },
    );
    this.logger.info(`AppointmentsService : Exit sortingTimestamp Method`);
    this.ECSlogger.info(`AppointmentsService : Exit sortingTimestamp Method`);
    return arr;
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
            return {
              durationInMins:
                response['rows'][0]['elements'][0]['duration']['text'],
              durationInSecs:
                response['rows'][0]['elements'][0]['duration']['value'],
            };
          }
        }
      }
    }
  }

  public getTimeDifference(date2, date1) {
    let diff = (date2.getTime() - date1.getTime()) / 1000;
    diff /= 60;
    return Math.abs(Math.round(diff));
  }

  private async getAppoinmentServiceDetail(
    appointments,
    domain_name,
    cutterId: any = null,
    tenant_id: string = null,
  ) {
    this.logger.info(
      `CustomerJourneyService : Enter getAppoinmentServiceDetail Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter getAppoinmentServiceDetail Method`,
    );

    const packages = {};

    const configObj = await this.getFranchisorConfig(tenant_id);
    let brand_name = '';
    if (tenant_id) {
      const brandData = await this.mvBrandRepository.findOne({
        tenant_id,
      });

      brand_name = brandData?.brand_name || '';
    }

    if (appointments && appointments.length) {
      for (const appointment of appointments) {
        appointment['brand_name'] = brand_name;
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

          appointment['customer_phone'] = userData?.phone || '';
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

            if (service.guest_name) {
              appointment['guest_name'] = service.guest_name;
              //commented the below line to resolve AMP-7197
              //appointment['customer_name'] = '';
            }

            //HERE
            const [serviceData] = await this.serviceRepository.query(
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
                const [serviceOptionData] = await this.serviceRepository.query(`
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
              const [cutterData] = await this.serviceRepository.query(
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
              const [package_data] = await this.serviceRepository.query(
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

  public removeTimeZone(date) {
    const dateValue = new Date(date).valueOf();
    return new Date(dateValue).toISOString().split('.')[0];
  }

  private async getCutterData(cutter_id, date, tenant_id) {
    this.logger.info(`CustomerJourneyService : Enter getCutterData Method`);
    this.ECSlogger.info(`CustomerJourneyService : Enter getCutterData Method`);

    const cutterObj = {};
    if (cutter_id) {
      const [cutterData] = await this.serviceRepository.query(
        `SELECT * FROM public.mv_cutter_schedule where employee_user_id = '${cutter_id}'`,
      );
      const configObj = await this.getFranchisorConfig(tenant_id);

      if (cutterData) {
        cutterObj[
          'cutter_name'
        ] = `${cutterData?.firstname} ${cutterData?.lastname}`;
        if (cutterData.image) {
          // const s3 = new AWS.S3();
          // const param = {
          //   Bucket: process.env.AWS_S3_BUCKET_NAME,
          //   Key: cutterData.image,
          // };
          // const url = await s3.getSignedUrl('getObject', param);
          // cutterObj['cutter_presigned_url'] = url;
          cutterObj['cutter_presigned_url'] = cutterData.image;
        } else {
          cutterObj['cutter_presigned_url'] = configObj['default_cutter_image'];
        }

        // find cutter's scheduled hours
        // const [hours] = await this.serviceRepository.query(`
        //   SELECT sum(number_of_hours) FROM mv_cutter_schedule WHERE employee_id = '${cutter_id}'
        //   AND shift_type = 'shift' AND (shift_start_time >= '${date} 00:00:00' AND shift_end_time <= '${date} 23:59:59')
        //   group by employee_user_id
        // `);
        const [hours] = await this.serviceRepository.query(`
          with employee_hours AS (
            select DISTINCT number_of_hours from mv_cutter_schedule where employee_id = '${cutter_id}'
            AND shift_type = 'shift' AND (shift_start_time >= '${date} 00:00:00' AND shift_end_time <= '${date} 23:59:59')
          )
          select sum(number_of_hours) from employee_hours
        `);

        cutterObj['scheduled_hours'] = +hours?.sum || 0;
      }
    }

    this.logger.info(`CustomerJourneyService : Exit getCutterData Method`);
    this.ECSlogger.info(`CustomerJourneyService : Exit getCutterData Method`);

    return cutterObj;
  }

  private async calculateBookedHours(appointments) {
    this.logger.info(
      `CustomerJourneyService : Enter calculateBookedHours Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter calculateBookedHours Method`,
    );

    let bookedHours = 0;
    let bookedMinutes = 0;
    for (const app of appointments) {
      if (!app.is_cancelled) {
        const end_date = new Date(app.appointment_end_time);
        const start_date = new Date(app.appointment_time);
        let hours = (end_date.getTime() - start_date.getTime()) / 1000;
        let minutes = (end_date.getTime() - start_date.getTime()) / 1000;
        hours /= 60 * 60;
        minutes /= 60;
        bookedHours += hours;
        bookedMinutes += minutes;
        // if (app?.service_booked?.length) {
        //   for (const service of app?.service_booked) {
        //   }
        // }
      }
    }

    this.logger.info(
      `CustomerJourneyService : Exit calculateBookedHours Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit calculateBookedHours Method`,
    );

    return {
      bookedHours: bookedHours.toFixed(2),
      bookedMinutes: bookedMinutes,
    };
  }

  private async getStoreOpenCloseTime(store_id, date) {
    this.logger.info(
      `CustomerJourneyService : Enter getStoreOpenCloseTime Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter getStoreOpenCloseTime Method`,
    );

    const currentDay = new Date(date).getDay();
    const dayName = Constant.WEEK_DAYS[currentDay];

    const [storeData] = await this.storeDetailRepository.query(`
      SELECT * FROM public.mv_stores where id = '${store_id}' AND weekday = '${dayName}'
    `);

    if (!storeData) {
      throw new Error('Store not found.');
    }

    let startDate = `${date} 10:00:00`;
    let endDate = `${date} 20:59:59`;

    // current date in store's timezone
    const storeTimezone = storeData?.timezone.toUpperCase() || 'UTC';
    const tzOffset = Constant.timezones[storeTimezone];
    const storeCurrentDate = moment()
      .tz(tzOffset)
      .format('YYYY-MM-DDTHH:mm:ss');

    if (storeData?.store_open_time && storeData?.store_end_time) {
      const startTime = storeData.store_open_time.split(' ')[0];
      let startHour = startTime.split(':')[0];
      const startMinute = startTime.split(':')[1];
      if (
        storeData.store_open_time.split(' ')[1].toLowerCase() === 'pm' &&
        +startHour !== 12
      ) {
        startHour = +startHour + 12;
      }

      if (
        storeData.store_open_time.split(' ')[1].toLowerCase() === 'am' &&
        +startHour === 12
      ) {
        startHour = '00';
      }

      if (+startHour <= 9) {
        startHour = '0' + +startHour;
      }
      const endTime = storeData.store_end_time.split(' ')[0];
      let endHour = endTime.split(':')[0];
      const endMinute = endTime.split(':')[1];
      if (
        storeData.store_end_time.split(' ')[1].toLowerCase() === 'pm' &&
        +endHour !== 12
      ) {
        endHour = +endHour + 12;
      }
      if (+endHour <= 9) {
        endHour = '0' + +endHour;
      }
      if (startHour && startMinute) {
        startDate = `${date}T${startHour}:${startMinute}:00`;
        endDate = `${date}T${endHour}:${endMinute}:59`;
      }
    }

    this.logger.info(
      `CustomerJourneyService : Exit getStoreOpenCloseTime Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit getStoreOpenCloseTime Method`,
    );

    return { startDate, endDate, storeCurrentDate };
  }

  async getGuestName(user_id: string) {
    const [userData] = await this.customerGuestUserRepository.find({
      where: {
        id: user_id,
      },
    });

    if (userData) {
      return userData.name;
    }
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
        const timezone =
          appointment?.store_timezone_name.toUpperCase() || 'UTC';
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

  // public generateAppointmentUniqId() {
  //   const timestamp = new Date().getTime().toString();
  //   const last8Digit = timestamp.substring(
  //     timestamp.length - 8,
  //     timestamp.length,
  //   );
  //   const uniqId = 'AR' + (+last8Digit + Math.ceil(Math.random() * 1000));
  //   return uniqId;
  // }

  public generateNewAppointmentUniqId(store_name: string) {
    // const storeSlug = store_name ? store_name.split(' ').join('') : 'AR';
    this.logger.info(
      `CustomerJourneyService : Enter generateNewAppointmentUniqId Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter generateNewAppointmentUniqId Method`,
    );

    let str = store_name;
    str = str.trim();
    let result = '';
    if (str.indexOf(' ') >= 0) {
      if (str.indexOf('-') >= 0) {
        const actual_string = str.split(' ');
        const indexesValue = [];
        actual_string.forEach(async (item) => {
          if (item.indexOf('-') > -1) {
            const actual_string = item.split('-');
            const finalStr = this.modifyAppointmentString(actual_string);
            indexesValue.push(finalStr);
          } else {
            const actual_string = item.split(' ');
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
        const actual_string = str.split(' ');
        result = this.modifyAppointmentString(actual_string).toLowerCase();
      }
    } else {
      const actual_string = str.split('-');
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
      `CustomerJourneyService : Exit generateNewAppointmentUniqId Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit generateNewAppointmentUniqId Method`,
    );

    return uniqId.toLocaleLowerCase();
  }

  async appointmentStatus() {
    this.logger.info(`CustomerJourneyService : Enter appointmentStatus Method`);
    this.ECSlogger.info(
      `CustomerJourneyService : Enter appointmentStatus Method`,
    );
    // publish messsge to rabbitmq
    const queueName = `${process.env.MODE}_appointment_status_update`;
    const publishObj = {
      appointment_id: 'cebfd876-7fb5-4e71-8dde-06d184b4abbd',
      is_cancelled: true,
      cancellation_charge: '10',
      cancellation_reason: 'Other Reason',
    };
    await this.cancelInvoiceRabitMQService.emitMqMessages(
      queueName,
      publishObj,
    );
    this.logger.info(`CustomerJourneyService : Exit appointmentStatus Method`);
    this.ECSlogger.info(
      `CustomerJourneyService : Exit appointmentStatus Method`,
    );
    return true;
  }

  public modifyAppointmentString(actual_string) {
    this.logger.info(
      `CustomerJourneyService : Enter modifyAppointmentString Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Enter modifyAppointmentString Method`,
    );
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

    this.logger.info(
      `CustomerJourneyService : Exit modifyAppointmentString Method`,
    );
    this.ECSlogger.info(
      `CustomerJourneyService : Exit modifyAppointmentString Method`,
    );

    return result;
  }

  async handleAppointmentStatus() {
    this.logger.info(
      `CommunicationService : Enter handleAppointmentStatus Method`,
    );
    this.ECSlogger.info(
      `CommunicationService : Enter handleAppointmentStatus Method`,
    );
    const todayDate = moment().format();
    const startDate = this.utilityService.getStartOfTheDay(todayDate);
    const endDate = this.utilityService.getEndOfTheDay(todayDate);
    const appointments = await this.appointmentRepository.query(
      `select * from appointment_appointment where appointment_time BETWEEN '${startDate}' and '${endDate}'`,
    );

    if (appointments?.length) {
      for (const appointment of appointments) {
        const timezone = appointment?.store_timezone.toUpperCase() || 'UTC';
        const currentDateOfStore = await this.getCurrentDateTimeOfStore(
          null,
          timezone,
        );
        let condition = false;
        condition =
          new Date(appointment.appointment_time) < new Date(currentDateOfStore);
        if (condition && appointment.status === 'booked') {
          await this.appointmentRepository.update(appointment.id, {
            status: 'pending',
          });
        }
      }
    }
    this.logger.info(
      `CommunicationService : Exit handleAppointmentStatus Method`,
    );
    this.ECSlogger.info(
      `CommunicationService : Exit handleAppointmentStatus Method`,
    );
  }

  async editAppointment(appointmentEditDto: AppointmentEditDto) {
    try {
      this.logger.info(`AppointmentsService : Enter editAppointment Method`);
      this.ECSlogger.info(`AppointmentsService : Enter editAppointment Method`);

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
        const id = appointmentEditDto.customer_id;
        let key = Constant.REDIS.userSerivceCartKey + id + '_*';
        const allKeys = await this.redisService.keys(key);
        if (allKeys.length > 0) {
          // Delete cart data from redis
          this.redisService.del(allKeys);
        }

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

        const configObj = await this.franchisorConfigRepository.find({
          where: {
            category: In(['appointment_service_config', 'customer_config']),
            tenant_id: appointment.tenant_id,
          },
        });

        // Add expire time with configurable time limit
        const current_time = new Date().getTime();
        const new_time =
          current_time + Constant.REDIS.expireMinutes * 60 * 1000;
        const expire_time = new Date(new_time);

        const ttlTime = await this.getTTLTime(appointmentEditDto.tenant_id);

        const addToCart = [];
        for (const service_booked of appointment.service_booked) {
          key = Constant.REDIS.userSerivceCartKey + id;
          key += `_${service_booked.service_id}`;

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
          const serviceData = await this.serviceRepository.findOne({
            service_id: service_booked.service_id,
          });

          const addToCartObj = {
            customer_id: appointmentEditDto.customer_id,
            customer_name:
              appointment.customer_details &&
              appointment.customer_details.fullname
                ? appointment.customer_details.fullname
                : '',
            cutter_id: service_booked.cutter_id,
            time_from: this.removeTimeZone(service_booked.exp_start_date),
            time_to: this.removeTimeZone(service_booked.exp_end_date),
            cutter_name: cutter_name,
            cutter_profile_image: cutter_presigned_url,
            guest_name: service_booked.guest_name
              ? service_booked.guest_name
              : '',
            guest_user_id: service_booked.guest_user_id
              ? service_booked.guest_user_id
              : '',
            store_id: service_booked.store_id,
            store_name: storeData ? storeData.name : '',
            package_id: service_booked.package_id
              ? service_booked.package_id
              : '',
            name: service_booked.service_or_package_name
              ? service_booked.service_or_package_name
              : serviceData && serviceData.service_name
              ? serviceData.service_name
              : '',
            package_name:
              service_booked.package_id &&
              service_booked.service_or_package_name
                ? service_booked.service_or_package_name
                : '',
            service_option_id: service_booked.service_option_id
              ? service_booked.service_option_id
              : '',
            service_option_name: service_booked.service_option_name
              ? service_booked.service_option_name
              : '',
            service_option_price: service_booked.service_option_price
              ? service_booked.service_option_price.toString()
              : '',
            service_options: [],
            logo: serviceData.service_image_url,
            price: service_booked.price.toString(),
            approx_time: service_booked.approx_time,
            discount: service_booked.discount
              ? service_booked.discount.toString()
              : '',
            discounted_price:
              service_booked.discount && +service_booked.discount
                ? +(
                    service_booked.price -
                    (service_booked.price * +service_booked.discount) / 100
                  )
                    .toFixed(2)
                    .toString()
                : service_booked.price.toString(),
            expire_time: expire_time,
            tenant_id: appointment.tenant_id,
            is_cutter_assigned: 0,
            appointment_id: appointment.id,
            is_edit_appointment: true,
            edit_appointment_time: this.removeTimeZone(
              appointment.appointment_time,
            ),
          };

          addToCartObj['appointment_service_id'] = service_booked.id;
          if (service_booked.service_option_id) {
            addToCartObj['selectedAddOns'] = {
              duration: service_booked.service_option_duration,
              id: service_booked.service_option_id,
              name: service_booked.service_option_name,
              price: service_booked.service_option_price.toString(),
            };
          } else {
            addToCartObj['selectedAddOns'] = '';
          }

          if (service_booked.package_id) {
            const service_id_arr = [];
            for (const booked of appointment.service_booked) {
              service_id_arr.push({
                id: booked.id,
                name: booked.service_name,
                price: booked.service_price.toString(),
                discounted_price: booked.service_discounted_price.toString(),
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
          addToCartObj['edit_appointment_item_ids'] = edit_appointment_item_ids;

          const foundCart = addToCart.find(
            (c) => c.package_id === service_booked.package_id,
          );
          if (!foundCart) {
            // addToCart.push(addToCartObj);
            const existingData = await this.redisService.get(key);
            let objToSet = [addToCartObj];
            if (existingData && existingData?.length) {
              objToSet = [...objToSet, ...existingData];
            }
            await this.redisService.set(key, objToSet, ttlTime);
          }
        }

        // await this.redisService.set(key, addToCart, ttlTime);
      } else {
        throw new NotFoundException(
          `Appointment #${appointmentEditDto.appointment_id} not found.`,
        );
      }
      this.logger.info(`AppointmentsService : Exit editAppointment Method`);
      this.ECSlogger.info(`AppointmentsService : Exit editAppointment Method`);
      return appointment;
    } catch (err) {
      throw err;
    }
  }

  async updateCartDetails(updateCartDto: UpdateCartDto) {
    try {
      this.logger.info(`AppointmentsService : Enter updateCartDetails Method`);
      this.ECSlogger.info(
        `AppointmentsService : Enter updateCartDetails Method`,
      );
      const id = updateCartDto.customer_id;
      let key = Constant.REDIS.userSerivceCartKey + id;
      key += `_${updateCartDto.service_id}`;
      const getExistingData = await this.redisService.get(key);
      if (getExistingData) {
        let foundServiceIndex = getExistingData.findIndex(
          (data) =>
            (data.service_id === updateCartDto.service_id ||
              data.package_id === updateCartDto.package_id) &&
            data.customer_id === id &&
            (!data.guest_user_id || !data.guest_name),
        );

        if (updateCartDto.guest_user_id) {
          foundServiceIndex = getExistingData.findIndex(
            (data) =>
              (data.service_id === updateCartDto.service_id ||
                data.package_id === updateCartDto.package_id) &&
              data.customer_id === id &&
              data.guest_user_id === updateCartDto.guest_user_id,
          );
        }

        if (foundServiceIndex !== -1) {
          getExistingData[foundServiceIndex]['cutter_id'] =
            updateCartDto.cutter_id;
          getExistingData[foundServiceIndex]['cutter_name'] =
            updateCartDto.cutter_name;
          getExistingData[foundServiceIndex]['cutter_profile_image'] =
            updateCartDto.cutter_image;
          getExistingData[foundServiceIndex]['time_from'] =
            updateCartDto.time_from;
          getExistingData[foundServiceIndex]['time_to'] = updateCartDto.time_to;

          const ttlTime = await this.getTTLTime(updateCartDto.tenant_id);
          this.redisService.set(key, getExistingData, ttlTime);
        }
      }
      this.logger.info(`AppointmentsService : Exit updateCartDetails Method`);
      this.ECSlogger.info(
        `AppointmentsService : Exit updateCartDetails Method`,
      );
      return updateCartDto;
    } catch (err) {
      throw err;
    }
  }
}
