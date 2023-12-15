import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CJAppointmentEditDto } from './edit-appointment.dto';

export class CJAppointmentEditRequestDto
  implements Readonly<CJAppointmentEditRequestDto>
{
  @ApiProperty()
  @ValidateNested()
  @Type(() => CJAppointmentEditDto)
  req_param: CJAppointmentEditDto;
}
