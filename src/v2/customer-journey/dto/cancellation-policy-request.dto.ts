import { ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CancellationPolicyDto } from './cancellation-poilcy.dto';

export class CJCancellationPoilcyRequestDto
  implements Readonly<CJCancellationPoilcyRequestDto>
{
  @ApiProperty()
  @ValidateNested()
  @Type(() => CancellationPolicyDto)
  req_param: CancellationPolicyDto;
}
