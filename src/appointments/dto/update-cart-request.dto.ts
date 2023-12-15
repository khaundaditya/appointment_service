import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { UpdateCartDto } from './update-cart.dto';

export class UpdateCartRequestDto implements Readonly<UpdateCartRequestDto> {
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => UpdateCartDto)
  req_param: UpdateCartDto;
}
