import { ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RemoveCartDto } from './remove-cart.dto';

export class CJRemoveCartRequestDto
  implements Readonly<CJRemoveCartRequestDto>
{
  @ApiProperty()
  @ValidateNested()
  @Type(() => RemoveCartDto)
  req_param: RemoveCartDto;
}
