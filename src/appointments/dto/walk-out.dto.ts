import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CustomerWalkout } from '../entities/customer-walkout.entity';

export class WalkOutDto implements Readonly<WalkOutDto> {
  @ApiProperty({
    example: 'Customer 1',
    description: 'Customer name',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  customer_name: string;

  @ApiProperty({
    example:
      '["4324610f-d632-4ab6-813f-efeaf74d1584", "4324610f-d632-4ab6-813f-efeaf74d1584"]',
    description: 'service id',
    required: true,
  })
  @IsNotEmpty()
  service_id: any;

  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'Cutter id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  cutter_id: string;

  @ApiProperty({
    example: '2021-07-30T07:57:58.508Z',
    description: 'Date',
    format: 'string',
    required: true,
  })
  @IsOptional()
  @IsString()
  date: string;

  @ApiProperty({
    example: '10:00 AM',
    description: 'time',
    format: 'string',
    required: true,
  })
  @IsOptional()
  @IsString()
  time: string;

  @ApiProperty({
    example: '1231231231',
    description: 'mobile number',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  mobile: string;

  @ApiProperty({
    example: '1',
    description: '0: customer, 1: guest',
    format: 'number',
    required: false,
  })
  @IsOptional()
  @IsString()
  is_guest: string;

  @ApiProperty({
    example: '4324610f-d632-4ab6-813f-efeaf74d1584',
    description: 'Store id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  store_id: string;

  public static toEntity(dto: Partial<WalkOutDto>) {
    const it = new CustomerWalkout();
    it.service_id = dto.service_id;
    it.cutter_id = dto.cutter_id;
    it.date = dto.date;
    it.customer_name = dto.customer_name;
    it.time = dto.time;
    it.mobile = dto.mobile;
    it.is_guest = dto.is_guest;
    return it;
  }
}
