import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CJAddToCartDto implements Readonly<CJAddToCartDto> {
  // Customer ID
  // TODO :: delete this after authguard delete
  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'The customer_id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  customer_id: string;

  /*@ApiProperty({
    example: 1,
    description: 'To identify service before login',
    format: 'number',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  is_for_customer: number;*/

  // service id
  @ApiProperty({
    example: '096a4e10-a49d-4067-b5dd-9ebf41f3c5d9',
    description: 'The service_id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  service_id: any;

  // store_id
  @ApiProperty({
    example: '6c76c713-234b-4787-b7da-1e5b75ffb439',
    description: 'The store_id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  store_id: string;

  // tenant_id
  @ApiProperty({
    example: '6c76c713-234b-4787-b7da-1e5b75ffb439',
    description: 'The tenant_id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  tenant_id: string;

  // employee_user_id
  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1585',
    description: 'The cutter_id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  cutter_id: string;

  // time_from
  @ApiProperty({
    example: '2021-07-30T07:17:58.508Z',
    description: 'The time_from',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  time_from: string;

  // time_to
  @ApiProperty({
    example: '2021-07-30T07:57:58.508Z',
    description: 'The time_to',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  time_to: string;

  @ApiProperty({
    example: 'Guest',
    description: 'Name of the guest',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  guest_name: string;

  @ApiProperty({
    example: '0006d7d8-864c-4749-a66f-e90ca69d805b',
    description: 'id of the guest',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  guest_user_id: string;

  @IsOptional()
  @IsString()
  guest_id: string;

  @ApiProperty({
    example: '3324610f-d632-4ab6-813f-efeaf74d1582',
    description: 'Package Id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  package_id: string;

  @ApiProperty({
    example: '3324610f-d632-4ab6-813f-efeaf74d1582',
    description: 'Service Option Id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  service_option_id: string;

  @ApiProperty({
    example: 10,
    description: 'Service Option price',
    format: 'number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  service_option_price: number;

  @ApiProperty({
    example: 'Add on',
    description: 'Service Option name',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  service_option_name: string;

  @ApiProperty({
    example: '120',
    description: 'Service Option duration',
    format: 'string',
    required: false,
  })
  @IsOptional()
  service_option_duration: any;

  @ApiProperty({
    example: 'John',
    description: 'Name of the cutter',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  cutter_name: string;

  @ApiProperty({
    example: 'https://goggle.com',
    description: 'profile image of the cutter',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  cutter_profile_image: string;

  @ApiProperty({
    example: 'hair Cutting',
    description: 'Name of the service',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'https://goggle.com',
    description: 'Image of the service',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  logo: string;

  @ApiProperty({
    example: 20,
    description: 'Price of the service',
    format: 'number',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  price: number;

  @ApiProperty({
    example: '10:00',
    description: 'Approx time of the service',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  approx_time: string;

  @ApiProperty({
    example: 10,
    description: 'Discount amount on service',
    format: 'number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  discount: number;

  @ApiProperty({
    example: 'Bridal Package',
    description: 'Package Name',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  package_name: string;

  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'appointment id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  appointment_id: string;

  @ApiProperty({
    example: 'Instruction to cutter',
    description: 'Cutter note',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  cutter_note: string;

  @ApiProperty({
    example: '2021-07-30T07:57:58.508Z',
    description: 'Expire Time',
    format: 'date',
    required: false,
  })
  @IsOptional()
  @IsString()
  expire_time: Date;

  @ApiProperty({
    example: '342123434',
    description: 'Uniq cart id',
    format: 'date',
    required: false,
  })
  @IsOptional()
  @IsString()
  cart_uniq_id: string;

  @ApiProperty({
    example: 1,
    description: 'To identify if cutter is recommended or not',
    format: 'number',
    required: true,
  })
  @IsOptional()
  @IsNumber()
  is_cutter_assigned: number;

  @ApiProperty({
    example: 'clear_slots/different_store',
    description: 'To identify what action do we need to manage',
    format: 'string',
  })
  @IsOptional()
  @IsString()
  error_type: string;

  @ApiProperty({
    example: 0 / 1,
    description: 'identify service is added from carousel or featured service',
    format: 'number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  is_from_carousel: number;
}
