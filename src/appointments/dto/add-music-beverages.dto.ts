import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddMusicBeveragesDto implements Readonly<AddMusicBeveragesDto> {
  @ApiProperty({
    example: '',
    description: 'Beverages',
    required: false,
  })
  @IsNotEmpty()
  beverages: any;

  @ApiProperty({
    example: '',
    description: 'music',
    required: false,
  })
  @IsNotEmpty()
  music: any;
}
