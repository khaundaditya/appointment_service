import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CloudinaryDto } from './cloudinary.dto';

export class CloudinaryRequestDto implements Readonly<CloudinaryRequestDto> {
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => CloudinaryDto)
  req_param: CloudinaryDto;
}
