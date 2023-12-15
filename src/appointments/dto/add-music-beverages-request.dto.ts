import { ApiProperty } from '@nestjs/swagger';
import { AddMusicBeveragesDto } from './add-music-beverages.dto';

export class AddMusicBeveragesRequestDto
  implements Readonly<AddMusicBeveragesRequestDto>
{
  // req_param
  @ApiProperty()
  req_param: AddMusicBeveragesDto;
}
