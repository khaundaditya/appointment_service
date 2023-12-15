import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CutterSlotsDto } from './cutter-slots.dto';

export class CutterSlotsRequestDto implements Readonly<CutterSlotsRequestDto> {
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => CutterSlotsDto)
  req_param: CutterSlotsDto;
}
