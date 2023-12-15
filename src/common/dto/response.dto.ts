import { ApiProperty } from '@nestjs/swagger';
import { ResDataDto } from './res-data.dto';

export class ResponseDto implements Readonly<ResponseDto> {
  // res_data
  @ApiProperty()
  res_data: ResDataDto;
}
