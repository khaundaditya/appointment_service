import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CJAppointmentConfirmDto
  implements Readonly<CJAppointmentConfirmDto>
{
  @ApiProperty({
    example: '2102080e-dbbd-41ef-b073-542e8a69303f',
    description: 'uuid fo a card',
    format: 'string',
    required: true,
  })
  @IsOptional()
  @IsString()
  card_id: string;

  @ApiProperty({
    example: '123412341234',
    description: 'Card number',
    format: 'string',
    required: true,
  })
  @IsOptional()
  @IsString()
  card_number: string;

  @ApiProperty({
    example: 'credit',
    description: 'Card type',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  card_type: string;

  @ApiProperty({
    example: 'Test user',
    description: 'Card Holder name',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  card_holder_name: string;

  @ApiProperty({
    example: '02/23',
    description: 'Card Expiry Date',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  expiry_date: string;

  @ApiProperty({
    example: 'online',
    description: 'Type of payment (online/cash)',
    required: false,
  })
  @IsNotEmpty()
  @IsString()
  payment_mode: string;

  @ApiProperty({
    example: '',
    description: 'service id',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  service_id: string;

  @ApiProperty({
    example: 'walking',
    description: 'booked_from',
    format: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  booked_from: string;
}
