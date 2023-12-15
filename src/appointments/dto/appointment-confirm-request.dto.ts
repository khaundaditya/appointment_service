import { ApiProperty } from '@nestjs/swagger';
import { AppointmentConfirmDto } from './appointment-confirm.dto';

export class AppointmentConfirmRequestDto
  implements Readonly<AppointmentConfirmRequestDto>
{
  // req_param
  @ApiProperty()
  req_param: AppointmentConfirmDto;
}
