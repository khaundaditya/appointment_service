import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CutterSlotsDto {
  @ApiProperty({
    example: [
      {
        customer_id: 'eb959a25-10c5-430a-bd6b-6c4cccf093c4',
        duration: [15],
      },
    ],
    description: 'Array of service duration',
    format: 'array',
    required: true,
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  duration: any;

  @ApiProperty({
    example: '8400e833-51f1-4e84-99c6-7b0e5450063f',
    description: 'The store_id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  store_id: string;

  @ApiProperty({
    example: '2022-01-17T12:00:00',
    description: 'start date from where slots will be calculated',
    format: 'string',
  })
  @IsOptional()
  @IsString()
  start_date: string;

  @ApiProperty({
    example: '2022-02-25',
    description: 'Date (YYYY-MM-DD)',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  date: string;

  @ApiProperty({
    example: 0,
    description: 'To identify whether need to check for next day slot or not.',
    format: 'number',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  is_first_time: number;

  @ApiProperty({
    example: 0,
    description: 'To identify from where api is being called',
    format: 'number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  is_from_edit: number;

  @ApiProperty({
    example: 'eb959a25-10c5-430a-bd6b-6c4cccf093c4',
    description: 'The cart_uniq_id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  cart_uniq_id: string;

  @ApiProperty({
    example: '4037990b-79cb-4cac-8601-1e030e1fd52c',
    description: 'The recommended_cutter_id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  recommended_cutter_id: string;

  appointment_id: string;
}
