import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CloudinaryDeleteImageDto } from './cloudinary-delete-image.dto';

export class CloudinaryDeleteImageRequestDto
  implements Readonly<CloudinaryDeleteImageRequestDto>
{
  // req_param
  @ApiProperty()
  @ValidateNested()
  @Type(() => CloudinaryDeleteImageDto)
  req_param: CloudinaryDeleteImageDto;
}
