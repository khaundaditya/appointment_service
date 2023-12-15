import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CJAddInstructionDto } from './add-instruction.dto';

export class CJAddInstructionRequestDto
  implements Readonly<CJAddInstructionRequestDto>
{
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => CJAddInstructionDto)
  req_param: CJAddInstructionDto;
}
