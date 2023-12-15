import { ApiProperty } from '@nestjs/swagger';
import { CreateSendMessageDto } from './create-send-message.dto';

export class CreateSendMessageRequestDto
  implements Readonly<CreateSendMessageRequestDto>
{
  // req_param
  @ApiProperty()
  req_param: CreateSendMessageDto;
}
