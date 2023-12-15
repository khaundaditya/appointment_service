import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Appointment } from './appointment.entity';

@Entity({ name: 'appointment_service_booked' })
export class AppointmentService extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  cutter_id: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid' })
  modified_by: string;

  @Column({ type: 'uuid' })
  appointment_id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'uuid' })
  service_id: string;

  @Column({ type: 'uuid' })
  service_option_id: string;

  @Column({ type: 'uuid' })
  package_id: string;

  @Column({ type: 'float' })
  price: number;

  @Column({ type: 'float' })
  tax: number;

  @Column({ type: 'varchar' })
  feedback: string;

  @Column({ type: 'varchar' })
  cutter_note: string;

  @Column({ type: 'varchar' })
  guest_name: string;

  @Column({ type: 'timestamptz' })
  exp_start_date: Date;

  @Column({ type: 'timestamptz' })
  exp_end_date: Date;

  @Column({ type: 'timestamptz' })
  actual_start_time: Date;

  @Column({ type: 'timestamptz' })
  actual_end_time: Date;

  @Column({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz' })
  modified_at: Date;

  @Column({ type: 'float' })
  cancellation_charge: number;

  @Column({ type: 'float' })
  extra_time: number;

  @Column({ type: 'varchar' })
  cancellation_reason: string;

  @ManyToOne(() => Appointment)
  @JoinColumn({ name: 'appointment_id', referencedColumnName: 'id' })
  appointment: Appointment;

  @Column({ type: 'uuid' })
  guest_user_id: string;

  @Column({ type: 'boolean' })
  is_existing_user: string;

  @Column({ type: 'float' })
  discount: number;

  @Column({ type: 'float' })
  service_option_price: number;

  @Column({ type: 'varchar' })
  service_option_name: string;

  @Column({ type: 'float' })
  service_price: number;

  @Column({ type: 'float' })
  service_discount: number;

  @Column({ type: 'float' })
  service_discounted_price: number;

  @Column({ type: 'integer' })
  is_cutter_assigned: number;

  @Column({ type: 'varchar' })
  service_or_package_name: string;

  @Column({ type: 'varchar' })
  service_name: string;

  @Column({ type: 'float' })
  approx_time: number;

  @Column({ type: 'integer' })
  service_option_duration: number;
}
