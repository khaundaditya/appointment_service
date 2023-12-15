import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CJAddGuestDto implements Readonly<CJAddGuestDto> {
  @ApiProperty({
    example: 'name of the guest',
    description: 'guest name',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  guest_name: string;

  @ApiProperty({
    example: '096a4e10-a49d-4067-b5dd-9ebf41f3c5d9',
    description: 'guest id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  guest_id: string;

  @ApiProperty({
    example: '0/1',
    description: 'Flag to identify add or remove guest',
    format: 'number',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  is_add: number;
}
