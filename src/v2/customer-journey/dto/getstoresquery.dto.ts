import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetStoresQueryDto {
  @IsString()
  @IsNotEmpty()
  city: string;

  lat: string;

  long: string;
  @IsString()
  @IsOptional()
  show_time_to_reach: string;
}
