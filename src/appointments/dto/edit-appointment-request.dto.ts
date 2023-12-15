import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { AppointmentEditDto } from './edit-appointment.dto';

export class AppointmentEditRequestDto
  implements Readonly<AppointmentEditRequestDto>
{
  @ApiProperty()
  @ValidateNested()
  @Type(() => AppointmentEditDto)
  req_param: AppointmentEditDto;
}
