import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetServiceDto implements Readonly<GetServiceDto> {
  // service id
  @IsNotEmpty()
  @ApiProperty({
    isArray: true,
    example: [
      '096a4e10-a49d-4067-b5dd-9ebf41f3c5d9',
      '296a4e10-a49d-4067-b5dd-9ebf41f3c5r9',
    ],
    description: 'Multiple or single service id',
    type: [],
    required: true,
  })
  services_id: [];
}
