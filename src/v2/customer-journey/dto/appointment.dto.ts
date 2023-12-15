import {
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AppointmentDto implements Readonly<AppointmentDto> {
  // customer_id
  @ApiProperty({
    example: 'customer_id',
    description: 'The customer_id',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customer_id: string;

  // employee_id
  @ApiProperty({
    example: 'employee_id',
    description: 'The employee_id',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  employee_id: string;

  // domain_name
  @ApiProperty({
    example: 'domain_name',
    description: 'The domain_name',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  domain_name: string;

  // filter
  @ApiProperty({
    example: 'filter',
    description: 'The filter',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filter: string;

  // start
  @ApiProperty({
    example: 'start',
    description: 'The start',
    format: 'number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  start: number;

  // limit
  @ApiProperty({
    example: 'limit',
    description: 'The limit',
    format: 'number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  limit: number;

  // store_id
  @ApiProperty({
    example: 'store_id',
    description: 'The store_id',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  store_id: string;

  // date
  @ApiProperty({
    example: 'date',
    description: 'The date',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  date: string;
  // tenant_id
  @ApiProperty({
    example: 'tenant_id',
    description: 'The tenant_id',
    format: 'string',
    required: false,
  })
  @MinLength(1)
  @MaxLength(255)
  tenant_id: string;
}
