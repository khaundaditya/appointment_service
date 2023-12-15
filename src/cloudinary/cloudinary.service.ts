import { Injectable } from '@nestjs/common';
import { v2 } from 'cloudinary';
import { RedisCacheService } from '../redis/redis.service';
import { CloudinaryDto } from './dto/cloudinary.dto';
import { UtilityService } from '../common/libs/utility.service';
import { CloudinaryDeleteImageDto } from './dto/cloudinary-delete-image.dto';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class CloudinaryService {
  constructor(
    private readonly redisService: RedisCacheService,
    private readonly utilityService: UtilityService,
    private readonly loggerService: LoggerService,
  ) {}
  public logger = this.loggerService.initiateLogger();

  async generateSignature(headers: any, cloudinaryDto: CloudinaryDto) {
    const secretValue = await this.utilityService.upAWSSecrets(
      headers.domain_name,
    );

    this.logger.info(
      `cloudnaryService : secretValue : ${JSON.stringify(secretValue)}`,
    );
    v2.config({
      cloud_name:
        secretValue[`${process.env.CLOUDINARY_MODE}/cloudinaryCloudName`],
      api_key: secretValue[`${process.env.CLOUDINARY_MODE}/cloudinaryApiKey`],
      api_secret:
        secretValue[`${process.env.CLOUDINARY_MODE}/cloudinaryApiSecret`],
    });

    const response = {
      timestamp: '',
      signature: '',
      source: '',
    };
    const sourceData = 'uw';

    const timestampData = Math.round(new Date().getTime() / 1000);
    const signatureData = await v2.utils.api_sign_request(
      {
        timestamp: timestampData,
        source: sourceData,
        folder: cloudinaryDto.folder_name,
      },
      secretValue[`${process.env.CLOUDINARY_MODE}/cloudinaryApiSecret`],
    );
    // this.redisService.set(
    //   'signature',
    //   { timestamp, signature, sourceData },
    //   3300,
    // );
    // const newData = await this.redisService.get('signature');
    response.signature = signatureData;
    response.timestamp = timestampData.toString();
    response.source = sourceData;
    return response;
  }

  async deleteCloudinaryImage(
    headers: any,
    cloudinaryDto: CloudinaryDeleteImageDto,
  ) {
    try {
      const secretValue = await this.utilityService.upAWSSecrets(
        headers.domain_name,
      );

      v2.config({
        cloud_name: secretValue['dev/cloudinaryCloudName'],
        api_key: secretValue['dev/cloudinaryApiKey'],
        api_secret: secretValue['dev/cloudinaryApiSecret'],
      });

      const deletedData = await v2.uploader.destroy(cloudinaryDto.image_ids);

      return deletedData;
    } catch (e) {
      throw e;
    }
  }

  async getCloudinaryImageDetails(headers: any, queryParams: any) {
    try {
      const secretValue = await this.utilityService.upAWSSecrets(
        headers.domain_name,
      );

      v2.config({
        cloud_name:
          secretValue[`${process.env.CLOUDINARY_MODE}/cloudinaryCloudName`],
        api_key: secretValue[`${process.env.CLOUDINARY_MODE}/cloudinaryApiKey`],
        api_secret:
          secretValue[`${process.env.CLOUDINARY_MODE}/cloudinaryApiSecret`],
      });

      const resourceData = await v2.api.resource(queryParams.publicId);

      return resourceData;
    } catch (e) {
      throw e;
    }
  }
}
