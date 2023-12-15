import { IsNotEmpty } from 'class-validator';

export class GetCartDetailsDto {
  @IsNotEmpty()
  id: string;
}
