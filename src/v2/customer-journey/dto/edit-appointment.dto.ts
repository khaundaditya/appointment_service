import {
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CJAppointmentEditDto implements Readonly<CJAppointmentEditDto> {
  // appointment_id
  @ApiProperty({
    example: 'c80714cb-1039-4875-a3da-f98ffe383df8',
    description: 'uuid of a appointment',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  appointment_id: string;

  // customer_id
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customer_id: string;

  // domain_name
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  domain_name: string;

  // error_type
  @ApiProperty({
    example: '',
    description: 'error_type',
    format: 'string',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  error_type: string;
}
