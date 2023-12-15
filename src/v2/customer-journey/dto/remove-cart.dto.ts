import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemoveCartDto implements Readonly<RemoveCartDto> {
  // cart unique ID
  // TODO :: delete this after authguard delete
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
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'service id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  services_id: string;

  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'package id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  package_id: string;

  @ApiProperty({
    example: 1,
    description:
      'To identify user accept for new slot (0 - inital call , 1 - user accept)',
    format: 'number',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  is_new_slot_accept: number;

  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'guest id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  guest_id: string;

  @ApiProperty({
    example: '1',
    description: '0 - default and 1- remove whole cart ',
    format: 'number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  is_remove_whole_cart: number;

  guest_name: string;
}
