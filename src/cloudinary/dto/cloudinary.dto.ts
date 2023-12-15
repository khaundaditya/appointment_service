import { IsNotEmpty, IsString } from 'class-validator';

export class CloudinaryDto implements Readonly<CloudinaryDto> {
  @IsNotEmpty()
  @IsString()
  folder_name: string;
}
