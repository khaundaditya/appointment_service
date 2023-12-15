import { IsNotEmpty, MinLength, MaxLength, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MvCutterSchedule } from '../entities/mv-cutter-schedule.view';

export class CutterAvailabilityDto implements Readonly<CutterAvailabilityDto> {
  // store_id
  @ApiProperty({
    example: '11a16371-55ae-48ce-8f11-a22a93a0ae2a',
    description: 'The store_id',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  store_id: string;

  // date
  @ApiProperty({
    example: '2021-09-28',
    description: 'The date',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  date: string;

  // service_duration
  @ApiProperty({
    example: '30',
    description: 'The service duration',
    format: 'service_duration',
    required: true,
  })
  @IsNotEmpty()
  service_duration: number;

  // req_type
  @ApiProperty({
    example: 'choose_cutter/preferred_by_saloon',
    description: 'The request type',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  req_type: string;

  // firstname
  firstname: string;

  // lastname
  lastname: string;

  // image
  image: string;

  // user_reviews
  user_reviews: string;

  // bio
  bio: string;

  // speciality
  speciality: string;

  // tenant_id
  tenant_id: string;

  // employee_user_id
  employee_user_id: string;

  // shift_type
  shift_type: string;

  // shift_start_time
  shift_start_time: Date;

  // shift_end_time
  shift_end_time: Date;

  // cutter_name
  cutter_name: string;

  // number_of_hours
  number_of_hours: number;

  // total_overtime_hours
  total_overtime_hours: number;

  appointment_id: string;

  public static from(dto: Partial<CutterAvailabilityDto>) {
    const it = new CutterAvailabilityDto();
    it.firstname = dto.firstname;
    it.lastname = dto.lastname;
    it.image = dto.image;
    it.user_reviews = dto.user_reviews;
    it.bio = dto.bio;
    it.speciality = dto.speciality;
    it.tenant_id = dto.tenant_id;
    it.employee_user_id = dto.employee_user_id;
    it.store_id = dto.store_id;
    it.shift_type = dto.shift_type;
    it.shift_start_time = dto.shift_start_time;
    it.shift_end_time = dto.shift_end_time;
    it.cutter_name = dto.cutter_name;
    it.number_of_hours = dto.number_of_hours;
    it.total_overtime_hours = dto.total_overtime_hours;
    return it;
  }

  public static fromEntity(entity: MvCutterSchedule) {
    return this.from({
      firstname: entity.firstname,
      lastname: entity.lastname,
      image: entity.image,
      user_reviews: entity.user_reviews,
      bio: entity.bio,
      speciality: entity.speciality,
      tenant_id: entity.tenant_id,
      employee_user_id: entity.employee_user_id,
      store_id: entity.store_id,
      shift_start_time: entity.shift_start_time,
      shift_end_time: entity.shift_end_time,
      cutter_name: entity.cutter_name,
      number_of_hours: entity.number_of_hours,
      total_overtime_hours: entity.total_overtime_hours,
    });
  }

  public static toEntity(dto: Partial<CutterAvailabilityDto>) {
    const it = new MvCutterSchedule();
    it.firstname = dto.firstname;
    it.lastname = dto.lastname;
    it.image = dto.image;
    it.user_reviews = dto.user_reviews;
    it.bio = dto.bio;
    it.speciality = dto.speciality;
    it.tenant_id = dto.tenant_id;
    it.employee_user_id = dto.employee_user_id;
    it.store_id = dto.store_id;
    it.shift_type = dto.shift_type;
    it.shift_start_time = dto.shift_start_time;
    it.shift_end_time = dto.shift_end_time;
    it.cutter_name = dto.cutter_name;
    it.number_of_hours = dto.number_of_hours;
    it.total_overtime_hours = dto.total_overtime_hours;
    return it;
  }
}
