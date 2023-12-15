import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAppointment implements Readonly<UpdateAppointment> {
  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'Appointment id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  appointment_id: string;

  @ApiProperty({
    example: 'checkin/checkout/cancel/edit',
    description: 'checkin/checkout/cancel/edit',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({
    example: 'reason',
    description: 'Cancellation reason',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  cancellation_reason: string;

  @ApiProperty({
    example: '10',
    description: 'Cancellation charge',
    format: 'number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  charge: number;

  @ApiProperty({
    example: 'reason',
    description: 'Reason for no show',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason_for_no_show: string;

  @ApiProperty({
    example: false,
    description: 'Need to cancel',
    format: 'boolean',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  need_to_cancel: boolean;
}
