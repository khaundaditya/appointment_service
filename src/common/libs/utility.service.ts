import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as moment from 'moment';

@Injectable()
export class UtilityService {
  private readonly envConfig = {};

  isNotEmptyObject(obj) {
    for (const prop in obj) {
      if (obj.hasOwnProperty(prop)) return true;
    }
    return false;
  }

  isEmptyObject(obj) {
    for (const prop in obj) {
      if (obj.hasOwnProperty(prop)) return false;
    }
    return true;
  }

  isStringWithValue(strValue) {
    if (strValue) {
      return true;
    }
    return false;
  }

  getResponse(data, message, statusCode, status = true, count = 0) {
    if (count) {
      return {
        res_data: {
          status,
          data: data,
          message: message,
          total_count: count,
          status_code: statusCode,
          server_time: this.removeTimeZone(this.getCurrentDateTime()),
        },
      };
    } else {
      return {
        res_data: {
          status,
          data: data,
          message: message,
          status_code: statusCode,
          server_time: this.removeTimeZone(this.getCurrentDateTime()),
        },
      };
    }
  }

  getErrorResponse(errorCode, errorMessage, actualError) {
    return {
      error: {
        status: false,
        error_code: errorCode,
        error_message: errorMessage,
        actual_error: actualError,
      },
    };
  }

  async upAWSSecrets(domain_name: string) {
    let error;

    const client = new AWS.SecretsManager();

    AWS.config.update({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const secrets = await client
      .getSecretValue({ SecretId: `${domain_name}-amplify` })
      .promise()
      .catch((err) => (error = err));

    if (error) {
      if (error.code === 'DecryptionFailureException')
        // Secrets Manager can't decrypt the protected secret text using the provided KMS key.
        // Deal with the exception here, and/or rethrow at your discretion.
        throw error;
      else if (error.code === 'InternalServiceErrorException')
        // An error occurred on the server side.
        // Deal with the exception here, and/or rethrow at your discretion.
        throw error;
      else if (error.code === 'InvalidParameterException')
        // You provided an invalid value for a parameter.
        // Deal with the exception here, and/or rethrow at your discretion.
        throw error;
      else if (error.code === 'InvalidRequestException')
        // You provided a parameter value that is not valid for the current state of the resource.
        // Deal with the exception here, and/or rethrow at your discretion.
        throw error;
      else if (error.code === 'ResourceNotFoundException')
        // We can't find the resource that you asked for.
        // Deal with the exception here, and/or rethrow at your discretion.
        throw error;
    }

    const resultSecrets = JSON.parse(secrets.SecretString);

    for (const key in resultSecrets) {
      this.envConfig[key] = resultSecrets[key];
    }
    return this.envConfig;
  }

  async generatePresignedUrl(bucketName: string, key: string) {
    // AWS.config.update({
    //   region: process.env.AWS_REGION,
    //   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    //   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    // });

    // const secretValue = await this.upAWSSecrets(domain_name);

    // const bucketName =
    //   secretValue[`${process.env.MODE.toLocaleLowerCase()}/AWS_S3_BUCKET_NAME`];

    const s3 = new AWS.S3();
    return s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: key,
    });
  }

  convertH2M(timeInHour: any) {
    const timeParts = timeInHour.split(':');
    return Number(timeParts[0]) * 60 + Number(timeParts[1]);
  }

  differenceInMins(date2, date1) {
    try {
      const time = new Date(date2).getTime() - new Date(date1).getTime();

      return time / (1000 * 60);
    } catch (err) {
      throw err;
    }
  }

  getStartOfTheDay(date: string) {
    return moment(date).startOf('day');
  }

  getEndOfTheDay(date: string) {
    return moment(date).endOf('day');
  }

  /**
   * This method get current date and time.
   *
   * @return
   */
  getCurrentDateTime() {
    return new Date();
  }

  removeTimeZone(date) {
    const dateValue = new Date(date).valueOf();
    return new Date(dateValue).toISOString().split('.')[0];
  }
}
