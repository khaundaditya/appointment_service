import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancellationPolicyDto implements Readonly<CancellationPolicyDto> {
  // Customer ID
  // TODO :: delete this after authguard delete
  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'customer id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  customer_id: string;

  @ApiProperty({
    example: '2021-15-12',
    description: 'Date (YYYY-MM-DD)',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  date: string;

  @ApiProperty({
    example: 1,
    description: 'accept /decline cancellation policy',
    format: 'number',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  is_accept: number;
}
