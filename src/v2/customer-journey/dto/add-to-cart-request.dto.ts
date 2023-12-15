import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CJAddToCartDto } from './add-to-cart.dto';

export class CJAddToCartRequestDto implements Readonly<CJAddToCartRequestDto> {
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => CJAddToCartDto)
  req_param: CJAddToCartDto;
}
