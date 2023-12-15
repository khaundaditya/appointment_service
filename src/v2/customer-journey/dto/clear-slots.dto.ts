import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CJClearSlotDto implements Readonly<CJClearSlotDto> {
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
    example: '1',
    description: 'Flag to identify remove previous services or not',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  is_different_store: number;
}
