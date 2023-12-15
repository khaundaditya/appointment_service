import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CJAddInstructionDto implements Readonly<CJAddInstructionDto> {
  @ApiProperty({
    example: 'this is instruction',
    description: 'Instruction to cutter',
    format: 'string',
    required: true,
  })
  @IsOptional()
  @IsString()
  cutter_note: string;

  @ApiProperty({
    example: '096a4e10-a49d-4067-b5dd-9ebf41f3c5d9',
    description: 'The cart uniq id',
    format: 'string',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  cart_uniq_id: string;

  @ApiProperty({
    example: '096a4e10-a49d-4067-b5dd-9ebf41f3c5d9',
    description: 'The customer id',
    format: 'string',
    required: true,
  })
  @IsOptional()
  @IsString()
  customer_id: string;

  @ApiProperty({
    example: '096a4e10-a49d-4067-b5dd-9ebf41f3c5d9',
    description: 'The guest id',
    format: 'string',
    required: true,
  })
  @IsOptional()
  @IsString()
  guest_user_id: string;

  @ApiProperty({
    example: 'giuest',
    description: 'Guest name',
    format: 'string',
    required: true,
  })
  @IsOptional()
  @IsString()
  guest_name: string;

  @ApiProperty({
    example: '096a4e10-a49d-4067-b5dd-9ebf41f3c5d9',
    description: 'The guest id',
    format: 'string',
    required: true,
  })
  @IsOptional()
  @IsString()
  guest_id: string;
}
