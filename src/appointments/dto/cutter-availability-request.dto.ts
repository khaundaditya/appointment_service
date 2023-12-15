import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CutterAvailabilityDto } from './cutter-availability.dto';

export class CutterAvailabilityRequestDto
  implements Readonly<CutterAvailabilityRequestDto>
{
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => CutterAvailabilityDto)
  req_param: CutterAvailabilityDto;
}
