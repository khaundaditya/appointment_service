import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRedisKeyDto implements Readonly<UpdateRedisKeyDto> {
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
    example: '4324610f-d632-4ab6-813f-efeaf74d1583',
    description: 'Customer id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  customer_id: string;
}
