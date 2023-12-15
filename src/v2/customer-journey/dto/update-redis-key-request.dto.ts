import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { UpdateRedisKeyDto } from './update-redis-key.dto';

export class UpdateRediskKeyRequestDto
  implements Readonly<UpdateRediskKeyRequestDto>
{
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => UpdateRedisKeyDto)
  req_param: UpdateRedisKeyDto;
}
