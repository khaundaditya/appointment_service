import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CJAddGuestDto } from './add-guest.dto';

export class CJAddGuestRequestDto implements Readonly<CJAddGuestRequestDto> {
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => CJAddGuestDto)
  req_param: CJAddGuestDto;
}
