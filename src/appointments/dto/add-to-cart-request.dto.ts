import { ApiProperty } from '@nestjs/swagger';
import { AddToCartDto } from './add-to-cart.dto';

export class AddToCartRequestDto implements Readonly<AddToCartRequestDto> {
  // req_param
  @ApiProperty()
  req_param: AddToCartDto;
}
