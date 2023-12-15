import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Appointment } from '../entities/appointment.entity';

export class AppointmentBookDto implements Readonly<AppointmentBookDto> {
  @IsNotEmpty()
  @IsString()
  tenant_id: string;

  @IsNotEmpty()
  @IsString()
  client_id: string;

  @IsNotEmpty()
  @IsString()
  appointment_time: Date;

  @IsNotEmpty()
  @IsString()
  appointment_end_time: Date;

  @IsNotEmpty()
  @IsNumber()
  total_price: number;

  @IsNotEmpty()
  @IsNumber()
  discount: number;

  @IsNotEmpty()
  @IsNumber()
  total_tax: number;

  @IsNotEmpty()
  @IsString()
  status: string;

  @IsNotEmpty()
  @IsString()
  checkin_time: Date;

  @IsNotEmpty()
  @IsString()
  checkout_time: Date;

  @IsNotEmpty()
  @IsString()
  created_by: string;

  @IsNotEmpty()
  card_details: any;

  @IsNotEmpty()
  beverages: any;

  @IsNotEmpty()
  music: any;

  @IsOptional()
  @IsString()
  guest_user_id: string;

  @IsOptional()
  @IsString()
  payment_mode: string;

  @IsOptional()
  @IsString()
  reason_for_no_show: string;

  @IsOptional()
  @IsNumber()
  is_cancelled: number;

  @IsOptional()
  @IsNumber()
  is_updated_by_cron: number;

  @IsOptional()
  @IsString()
  store_timezone: string;

  @IsOptional()
  @IsString()
  appointment_uniq_id: string;

  @IsOptional()
  @IsString()
  requested_from: string;

  @IsOptional()
  @IsNumber()
  cancellation_charge: number;

  @IsOptional()
  @IsString()
  booked_from: string;

  @IsOptional()
  @IsString()
  is_rebook_by_admin: string;

  public static toEntity(dto: Partial<AppointmentBookDto>) {
    const it = new Appointment();
    it.tenant_id = dto.tenant_id;
    it.client_id = dto.client_id;
    it.appointment_time = dto.appointment_time;
    it.appointment_end_time = dto.appointment_end_time;
    it.total_price = dto.total_price;
    it.discount = dto.discount;
    it.total_tax = dto.total_tax;
    it.status = dto.status;
    it.checkin_time = dto.checkin_time;
    it.checkout_time = dto.checkout_time;
    it.created_by = dto.created_by;
    it.card_details = dto.card_details;
    it.beverages = dto.beverages;
    it.music = dto.music;
    it.guest_user_id = dto.guest_user_id;
    it.payment_mode = dto.payment_mode;
    it.reason_for_no_show = dto.reason_for_no_show;
    it.is_cancelled = dto.is_cancelled;
    it.is_updated_by_cron = dto.is_updated_by_cron;
    it.store_timezone = dto.store_timezone;
    it.appointment_uniq_id = dto.appointment_uniq_id;
    it.requested_from = dto.requested_from;
    it.cancellation_charge = dto.cancellation_charge;
    it.booked_from = dto.booked_from;
    it.is_rebook_by_admin = dto.is_rebook_by_admin;
    return it;
  }
}
