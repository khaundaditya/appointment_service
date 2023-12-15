import {
  IsNotEmpty,
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateCartDto implements Readonly<UpdateCartDto> {
  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'Uniq cart id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  cart_uniq_id: string;

  @ApiProperty({
    example: '',
    description: 'Array of object for different users',
    format: 'string',
    required: true,
  })
  @ValidateNested({ each: true })
  @Type(() => CartDetailsDto)
  cart_details: CartDetailsDto[];

  appointment_id: string;
}

class CartDetailsDto {
  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'customer id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  customer_id: string;

  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'customer id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  guest_user_id: string;

  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'guest_id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  guest_id: string;

  // @ApiProperty({
  //   example: 1,
  //   description: 'To identify service before login',
  //   format: 'number',
  //   required: true,
  // })
  // @IsNotEmpty()
  // @IsNumber()
  // is_for_customer: number;

  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'cutter id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  cutter_id: string;

  @ApiProperty({
    example: 'cutter 1',
    description: 'cutter name',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  cutter_name: string;

  @ApiProperty({
    example: '',
    description: 'S3 url of cutter profile',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  cutter_image: string;

  @ApiProperty({
    example: '2021-12-122 12:00:00',
    description: 'Start time of service',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  time_from: string;

  @ApiProperty({
    example: '2021-12-122 13:00:00',
    description: 'End time of service',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  time_to: string;

  @ApiProperty({
    example: 'GUEST ',
    description: 'guest name',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  guest_name: string;
}
