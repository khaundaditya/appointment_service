import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { AppointmentService } from '../entities/appointment-service.entity';

export class AppointmentServiceDto implements Readonly<AppointmentServiceDto> {
  @IsNotEmpty()
  @IsString()
  tenant_id: string;

  @IsNotEmpty()
  @IsString()
  cutter_id: string;

  @IsNotEmpty()
  @IsString()
  appointment_id: string;

  @IsNotEmpty()
  @IsString()
  store_id: string;

  @IsNotEmpty()
  @IsNumber()
  price: number;

  @IsNotEmpty()
  @IsNumber()
  tax: number;

  @IsNotEmpty()
  @IsString()
  feedback: string;

  @IsNotEmpty()
  @IsString()
  exp_start_date: Date;

  @IsNotEmpty()
  @IsString()
  exp_end_date: Date;

  @IsNotEmpty()
  @IsString()
  actual_start_time: Date;

  @IsNotEmpty()
  @IsString()
  actual_end_time: Date;

  @IsNotEmpty()
  @IsString()
  modified_by: string;

  @IsNotEmpty()
  @IsString()
  service_id: string;

  @IsOptional()
  @IsString()
  package_id: string;

  @IsNotEmpty()
  @IsString()
  created_by: string;

  @IsOptional()
  @IsString()
  guest_name: string;

  @IsOptional()
  @IsString()
  service_option_id: string;

  @IsOptional()
  @IsString()
  cutter_note: string;

  @IsOptional()
  @IsString()
  guest_user_id: string;

  @IsOptional()
  @IsString()
  is_existing_user: string;

  @IsOptional()
  @IsNumber()
  discount: number;

  @IsOptional()
  @IsString()
  service_option_name: string;

  @IsOptional()
  service_option_price: number;

  @IsOptional()
  service_price: number;

  @IsOptional()
  service_discount: number;

  @IsOptional()
  service_discounted_price: number;

  @IsOptional()
  @IsNumber()
  is_cutter_assigned: number;

  @IsOptional()
  @IsString()
  service_or_package_name: string;

  @IsOptional()
  @IsString()
  service_name: string;

  @IsOptional()
  approx_time: number;

  public static toEntity(dto: Partial<AppointmentServiceDto>) {
    const it = new AppointmentService();
    it.tenant_id = dto.tenant_id;
    it.cutter_id = dto.cutter_id;
    it.appointment_id = dto.appointment_id;
    it.store_id = dto.store_id;
    it.price = dto.price;
    it.tax = dto.tax;
    it.feedback = dto.feedback;
    it.exp_start_date = dto.exp_start_date;
    it.exp_end_date = dto.exp_end_date;
    it.actual_start_time = dto.actual_start_time;
    it.actual_end_time = dto.actual_end_time;
    it.modified_by = dto.modified_by;
    it.service_id = dto.service_id;
    it.package_id = dto.package_id;
    it.created_by = dto.created_by;
    it.guest_name = dto.guest_name;
    it.service_option_id = dto.service_option_id;
    it.cutter_note = dto.cutter_note;
    it.guest_user_id = dto.guest_user_id;
    it.is_existing_user = dto.is_existing_user;
    it.discount = dto.discount;
    it.service_option_price = dto.service_option_price;
    it.service_option_name = dto.service_option_name;
    it.service_price = dto.service_price;
    it.service_discounted_price = dto.service_discounted_price;
    it.service_discount = dto.service_discount;
    it.is_cutter_assigned = dto.is_cutter_assigned;
    it.service_or_package_name = dto.service_or_package_name;
    it.service_name = dto.service_name;
    it.approx_time = dto.approx_time;
    return it;
  }
}
