import {
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AppointmentEditDto implements Readonly<AppointmentEditDto> {
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

  // tenant_id
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  tenant_id: string;
}
