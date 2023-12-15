import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CJGoogleMatrixDto } from './googlematrixapi.dto';

export class CJGoogleMatrixRequestDto
  implements Readonly<CJGoogleMatrixRequestDto>
{
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => CJGoogleMatrixDto)
  req_param: CJGoogleMatrixDto;
}
