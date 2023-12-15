import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CJClearSlotDto } from './clear-slots.dto';

export class CJClearSlotsRequestDto
  implements Readonly<CJClearSlotsRequestDto>
{
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => CJClearSlotDto)
  req_param: CJClearSlotDto;
}
