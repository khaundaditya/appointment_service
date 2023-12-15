import { IsNotEmpty, MinLength, MaxLength, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSendMessageDto {
  // phone
  @ApiProperty({
    example: 'phone',
    description: 'The phone',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  phone: string;

  // message
  @ApiProperty({
    example: 'message',
    description: 'The message',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  message: string;
}
