import { ApiProperty } from '@nestjs/swagger';
import { GetServiceDto } from './service-details.dto';

export class GetServiceRequestDto implements Readonly<GetServiceRequestDto> {
  // req_param
  @ApiProperty()
  req_param: GetServiceDto;
}
