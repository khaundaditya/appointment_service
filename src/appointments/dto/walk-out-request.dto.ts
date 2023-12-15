import { ApiProperty } from '@nestjs/swagger';
import { WalkOutDto } from './walk-out.dto';

export class WalkOutRequestDto implements Readonly<WalkOutRequestDto> {
  // req_param
  @ApiProperty()
  req_param: WalkOutDto;
}
