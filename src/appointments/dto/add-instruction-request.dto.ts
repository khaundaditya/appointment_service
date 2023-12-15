import { ApiProperty } from '@nestjs/swagger';
import { AddInstructionDto } from './add-instruction.dto';

export class AddInstructionRequestDto
  implements Readonly<AddInstructionRequestDto>
{
  // req_param
  @ApiProperty()
  req_param: AddInstructionDto;
}
