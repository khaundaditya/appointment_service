import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CJAppointmentConfirmDto } from './confirm-appointment.dto';

export class CJAppointmentConfirmRequestDto
  implements Readonly<CJAppointmentConfirmRequestDto>
{
  @ApiProperty()
  @ValidateNested()
  @Type(() => CJAppointmentConfirmDto)
  req_param: CJAppointmentConfirmDto;
}
