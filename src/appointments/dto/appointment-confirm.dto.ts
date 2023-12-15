import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AppointmentConfirmDto implements Readonly<AppointmentConfirmDto> {
  @ApiProperty({
    example: '2102080e-dbbd-41ef-b073-542e8a69303f',
    description: 'uuid fo a card',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  card_id: string;

  @ApiProperty({
    example: '123412341234',
    description: 'Card number',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  card_number: string;

  @ApiProperty({
    example: 'credit',
    description: 'Card type',
    format: 'string',
    required: false,
  })
  @IsNotEmpty()
  @IsNumber()
  card_type: string;

  @ApiProperty({
    example: 'Test user',
    description: 'Card Holder name',
    format: 'string',
    required: false,
  })
  @IsNotEmpty()
  @IsNumber()
  card_holder_name: string;

  @ApiProperty({
    example: '02/23',
    description: 'Card Expiry Date',
    format: 'string',
    required: false,
  })
  @IsNotEmpty()
  @IsNumber()
  expiry_date: string;

  @ApiProperty({
    example: '',
    description: 'Beverages',
    required: false,
  })
  @IsNotEmpty()
  beverages: any;

  @ApiProperty({
    example: '',
    description: 'music',
    required: false,
  })
  @IsNotEmpty()
  music: any;

  @ApiProperty({
    example: 'online',
    description: 'Type of payment (online/cash)',
    required: false,
  })
  @IsNotEmpty()
  payment_mode: any;

  @ApiProperty({
    example: 'false',
    description: 'True or False',
    required: false,
  })
  @IsNotEmpty()
  is_rebook_by_admin: string;

  @ApiProperty({
    example: 'walkin',
    description: 'booked_from',
    required: false,
  })
  @IsNotEmpty()
  @IsString()
  booked_from: string;
}
