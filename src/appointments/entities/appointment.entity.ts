import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { AppointmentService } from './appointment-service.entity';
import { CustomerUser } from '../../users/entities/customer-user.entity';
import { CustomerGuestUser } from '../../users/entities/customer-guest-user.entity';

@Entity({ name: 'appointment_appointment' })
export class Appointment extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  guest_user_id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid' })
  modified_by: string;

  @Column({ type: 'timestamp' })
  appointment_time: Date;

  @Column({ type: 'timestamp' })
  appointment_end_time: Date;

  @Column({ type: 'float' })
  total_price: number;

  @Column({ type: 'float' })
  discount: number;

  @Column({ type: 'float' })
  total_tax: number;

  @Column({ type: 'float' })
  cancellation_charge: number;

  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'varchar' })
  cancellation_reason: string;

  @Column({ type: 'varchar' })
  payment_mode: string;

  @Column({ type: 'varchar' })
  reason_for_no_show: string;

  @Column({ type: 'timestamptz' })
  checkin_time: Date;

  @Column({ type: 'timestamptz' })
  checkout_time: Date;

  @Column({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'json' })
  card_details: any;

  @Column({ type: 'json' })
  beverages: any;

  @Column({ type: 'json' })
  music: any;

  @Column({ type: 'integer' })
  is_cancelled: number;

  @Column({ type: 'integer' })
  is_updated_by_cron: number;

  @Column({ type: 'varchar' })
  store_timezone: string;

  @Column({ type: 'varchar' })
  appointment_uniq_id: string;

  @Column({ type: 'varchar' })
  requested_from: string;

  @Column({ type: 'boolean' })
  is_rebook_by_admin: string;

  @OneToMany(
    () => AppointmentService,
    (service_booked) => service_booked.appointment,
  )
  service_booked: AppointmentService[];

  @OneToOne(() => CustomerUser)
  @JoinColumn({ name: 'client_id' })
  customer_details: CustomerUser;

  @OneToOne(() => CustomerGuestUser)
  @JoinColumn({ name: 'guest_user_id' })
  customer_guest_details: CustomerGuestUser;

  @Column({ type: 'varchar' })
  booked_from: string;
}
