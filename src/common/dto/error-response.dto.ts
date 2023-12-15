import { ApiProperty } from '@nestjs/swagger';
import { ErrorDto } from './error.dto';

export class ErrorResponseDto implements Readonly<ErrorResponseDto> {
  // res_data
  @ApiProperty()
  error: ErrorDto;
}
