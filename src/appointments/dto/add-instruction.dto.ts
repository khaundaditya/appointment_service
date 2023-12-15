import {
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddInstructionDto implements Readonly<AddInstructionDto> {
  @ApiProperty({
    example: 'this is instruction',
    description: 'Instruction to cutter',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  cutter_note: string;

  // service id
  @ApiProperty({
    example: '096a4e10-a49d-4067-b5dd-9ebf41f3c5d9',
    description: 'The service_id',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  service_id: string;

  // time_from
  @ApiProperty({
    example: '2021-07-30T07:17:58.508Z',
    description: 'The time_from',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  time_from: string;

  // time_to
  @ApiProperty({
    example: '2021-07-30T07:57:58.508Z',
    description: 'The time_to',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  time_to: string;

  @ApiProperty({
    example: '',
    description:
      'If you are adding instruction for package then only pass this id',
    format: 'string',
    minLength: 1,
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  package_id: string;
}
