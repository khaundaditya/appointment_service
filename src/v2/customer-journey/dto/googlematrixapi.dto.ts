import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CJGoogleMatrixDto implements Readonly<CJGoogleMatrixDto> {
  // Customer ID
  // TODO :: delete this after authguard delete
  @ApiProperty({
    example: 'True or False',
    description: 'The customer_id',
    format: 'boolean',
    required: false,
  })
  @IsOptional()
  @IsString()
  show_time_to_reach: boolean;
}
