import { IsNotEmpty, MinLength, MaxLength, IsString } from 'class-validator';

export class CreateLogDataDto {
  // tenant_id
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  tenant_id: string;

  // request_id
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  request_id: string;

  // request_url
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  request_url: string;

  // api_name
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  api_name: string;

  // http_method
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  http_method: string;

  // host
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host: string;

  // logs
  logs: any;

  // queue_name
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  queue_name: string;

  // created_by
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  created_by: string;
}
