import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAppointmentService
  implements Readonly<UpdateAppointmentService>
{
  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'Appointment service id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  appointment_service_id: string;

  @ApiProperty({
    example: 'checkin',
    description: 'checkin/checkout/cancel',
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
  cancellation_charge: number;

  @ApiProperty({
    example: '10',
    description: 'Extra time',
    format: 'number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  extra_time: number;
}
