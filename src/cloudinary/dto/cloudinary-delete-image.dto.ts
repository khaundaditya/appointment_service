import { IsNotEmpty, IsString } from 'class-validator';

export class CloudinaryDeleteImageDto {
  @IsNotEmpty()
  @IsString()
  image_ids: string;
}
