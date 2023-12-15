import { ApiProperty } from '@nestjs/swagger';
import { UpdateAppointmentService } from './update-service.dto';

export class UpdateAppointmentServiceRequest
  implements Readonly<UpdateAppointmentServiceRequest>
{
  // req_param
  @ApiProperty()
  req_param: UpdateAppointmentService;
}
