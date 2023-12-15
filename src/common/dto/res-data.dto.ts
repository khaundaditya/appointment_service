import { ApiProperty } from '@nestjs/swagger';

export class ResDataDto implements Readonly<ResDataDto> {
  // data
  @ApiProperty()
  data: any;

  // message
  @ApiProperty()
  message: string;

  // status_code
  @ApiProperty()
  status_code: number;
}
