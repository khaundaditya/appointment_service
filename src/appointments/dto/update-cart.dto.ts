import {
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateCartDto implements Readonly<UpdateCartDto> {
  customer_id: string;

  tenant_id: string;

  @ApiProperty({
    example: '7545622a-7aa7-43c3-ae8b-7ec00abe5cfd',
    description: 'The service_id',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  service_id: string;

  @ApiProperty({
    example: '7545622a-7aa7-43c3-ae8b-7ec00abe5cfd',
    description: 'package id',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  package_id: string;

  @ApiProperty({
    example: 'f5fc8488-8868-456e-89a0-e97c9e392d4e',
    description: 'cutter id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  cutter_id: string;

  @ApiProperty({
    example: 'Aarambh Porwal',
    description: 'cutter name',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  cutter_name: string;

  @ApiProperty({
    example:
      'dev/dieselbarbershop-amplify/images/employee/e5budos270zxryfckxp6.jpg',
    description: 'S3 url of cutter profile',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  cutter_image: string;

  @ApiProperty({
    example: '2022-04-22T10:20:00',
    description: 'Start time of service',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  time_from: string;

  @ApiProperty({
    example: '2022-04-22T10:40:00',
    description: 'End time of service',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  time_to: string;

  guest_user_id: string;
}
