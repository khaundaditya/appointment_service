import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Repository } from 'typeorm';
import { LoggerService } from '../logger/logger.service';
import * as amqp from 'amqplib';
import { NotificationCategory } from '../appointments/entities/notification-category.entity';
import { MvStores } from '../appointments/entities/mv-store.view';
import { NotificationType } from '../appointments/entities/notification-type.entity';
import { MvBrands } from '../appointments/entities/mv-brands.view';
import { UsersService } from '../users/users.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { MvCutterSchedule } from '../appointments/entities/mv-cutter-schedule.view';

@Injectable()
export class CancelInvoiceRabitMQService {
  constructor(
    @Inject(`${process.env.MQ_SERVICE_NAME}`) private client: ClientProxy,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private readonly loggerService: LoggerService,
    @InjectRepository(NotificationCategory)
    private notificationCategoryRepository: Repository<NotificationCategory>,
    @InjectRepository(MvStores)
    private storeDetailRepository: Repository<MvStores>,
    @InjectRepository(NotificationType)
    private notificationTypeRepository: Repository<NotificationType>,
    @InjectRepository(MvBrands)
    private brandViewRepository: Repository<MvBrands>,
    private readonly usersService: UsersService,
    private readonly rabbitMQService: RabbitMQService,
    @InjectRepository(MvCutterSchedule)
    private cutterScheduleRepository: Repository<MvCutterSchedule>,
  ) {}

  public logger = this.loggerService.initiateLogger();

  public async emitMqMessages(queueName, mqData) {
    try {
      const url = `${process.env.MQ_PREFIX}://${process.env.MQ_USERNAME}:${process.env.MQ_PASSWORD}@${process.env.MQ_URL}:${process.env.MQ_PORT}`;

      const connection = await amqp.connect(url);

      const channel = await connection.createChannel();

      channel.assertQueue(queueName, {
        durable: true,
      });

      channel.sendToQueue(queueName, Buffer.from(JSON.stringify(mqData)));

      this.logger.info(`[x] Sent ${mqData} - ${new Date()}`);

      setTimeout(function () {
        connection.close();
      }, 500);
    } catch (err) {
      console.log('err =====> ', err);
    }
  }

  public async updateAppointmentStatus(data) {
    if (data?.appointment_id) {
      const objToUpdate = {
        status: 'completed',
      };
      if (data?.cancellation_reason) {
        objToUpdate['cancellation_reason'] = data.cancellation_reason;
      }

      if (data?.is_cancelled) {
        objToUpdate['is_cancelled'] = 1;
        // get appointment details
        const appointmentData = await this.appointmentRepository.findOne({
          relations: [
            'service_booked',
            'customer_details',
            'customer_details.customer_preference',
          ],
          where: {
            id: data.appointment_id,
          },
        });
        // emit event in rabbitmq
        if (appointmentData) {
          const userData = appointmentData.customer_details;

          // get category id from notification_category table
          const [notificationCategory] =
            await this.notificationCategoryRepository.find({
              where: {
                category: 'CANCEL_APPOINTMENT',
              },
            });

          const notificationTypes =
            await this.notificationTypeRepository.find();

          // Note: get brand details.
          const brandData = await this.brandViewRepository.findOne({
            tenant_id: appointmentData.tenant_id,
          });

          const service_name = [];
          let store_id = null;
          const guest_name = [];
          const cutter_name = [];
          for (const service_booked of appointmentData.service_booked) {
            service_name.push(service_booked.service_or_package_name);
            store_id = service_booked.store_id;
            if (service_booked.guest_name) {
              guest_name.push(service_booked.guest_name);
            }
            // Note: get cutter details.
            const cutterData = await this.cutterScheduleRepository.findOne({
              employee_user_id: service_booked.cutter_id,
            });
            cutter_name.push(
              cutterData
                ? cutterData.firstname + ' ' + cutterData.lastname
                : '',
            );
          }

          // Note: get store details.
          const storeData = await this.storeDetailRepository.findOne({
            id: store_id,
          });

          let store_address = storeData.address ? storeData.address + ', ' : '';
          store_address += storeData.street_name
            ? storeData.street_name + ', '
            : '';
          store_address += storeData.suite_number
            ? storeData.suite_number + ', '
            : '';
          store_address += storeData.city ? storeData.city + ', ' : '';
          store_address += storeData.state ? storeData.state + ', ' : '';
          store_address += storeData.zipcode ? storeData.zipcode : '';

          const notificationObj: any = {
            appointment_uniq_id: appointmentData.appointment_uniq_id,
            tenant_id: appointmentData.tenant_id,
            category_id: notificationCategory.id,
            user_type: 'customer',
            title: `Appointment Canceled`,
            message_id: appointmentData.id,
            message: `You canceled ${[...new Set(service_name)].join(
              ', ',
            )} services for you at ${storeData.name}`,
            schedule_time: appointmentData.appointment_time,
            receiver_id: appointmentData.client_id,
            expiry_date: appointmentData.appointment_end_time,
            created_by: appointmentData.client_id,
            appointment_id: appointmentData.id,
            service_name: [...new Set(service_name)].join(', '),
            date_time: appointmentData.appointment_time,
            time_from: appointmentData.appointment_time,
            time_to: appointmentData.appointment_end_time,
            customer_name: `${userData.fullname ? userData.fullname : ''}`,
            guest_name: [...new Set(guest_name)].join(', '),
            cutter_name: [...new Set(cutter_name)].join(', '),
            service_price: appointmentData.total_price,
            store_name: storeData && storeData.name ? storeData.name : '',
            store_timezone:
              storeData && storeData.timezone ? storeData.timezone : '',
            store_address: store_address ? store_address : '',
            brand_name: brandData ? brandData.brand_name : '',
            domain_name: brandData ? brandData.slug : '',
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
          }
          this.logger.info(
            `CancelInvoiceRabitMQService : updateAppointmentStatus : notificationObj : ${JSON.stringify(
              notificationObj,
            )}`,
          );
          // publish message to rabbitmq
          await this.rabbitMQService.emitMqMessages(
            'create_notification',
            notificationObj,
          );
        }
      } else {
        const appointmentData = await this.appointmentRepository.findOne({
          where: {
            id: data.appointment_id,
          },
        });
        // emit event in rabbitmq
        if (appointmentData) {
          // get category id from notification_category table
          const [notificationCategory] =
            await this.notificationCategoryRepository.find({
              where: {
                category: 'CUSTOMER_FEEDBACK',
              },
            });

          const notificationObj: any = {
            tenant_id: appointmentData.tenant_id,
            category_id: notificationCategory.id,
            user_type: 'customer',
            title: 'Tell us about your experience',
            message_id: appointmentData.id,
            message:
              'We would love to hear about your Salon Experience with us. Rate and review us',
            schedule_time: appointmentData.appointment_time,
            receiver_id: appointmentData.client_id,
            expiry_date: appointmentData.appointment_end_time,
            date_time: appointmentData.appointment_time,
            time_from: appointmentData.appointment_time,
            time_to: appointmentData.appointment_end_time,
            created_by: appointmentData.client_id,
          };

          this.logger.info(
            `CancelInvoiceRabitMQService : updateAppointmentStatus : notificationObj : ${JSON.stringify(
              notificationObj,
            )}`,
          );
          // publish message to rabbitmq
          await this.rabbitMQService.emitMqMessages(
            'create_notification',
            notificationObj,
          );
        }

        await this.appointmentRepository.update(
          {
            id: data.appointment_id,
          },
          objToUpdate,
        );
      }
    }
  }

  public removeTimeZone(date) {
    const dateValue = new Date(date).valueOf();
    return new Date(dateValue).toISOString().split('.')[0];
  }
}
