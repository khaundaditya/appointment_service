import { ApiProperty } from '@nestjs/swagger';
import { UpdateAppointment } from './update-appointment.dto';

export class UpdateAppointmentRequest
  implements Readonly<UpdateAppointmentRequest>
{
  // req_param
  @ApiProperty()
  req_param: UpdateAppointment;
}
