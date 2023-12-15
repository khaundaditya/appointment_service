import { ApiProperty } from '@nestjs/swagger';

export class ErrorDto implements Readonly<ErrorDto> {
  // error_code
  @ApiProperty()
  error_code: number;

  // error_message
  @ApiProperty()
  error_message: string;

  // actual_error
  @ApiProperty()
  actual_error: string;
}
