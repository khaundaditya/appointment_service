#!/bin/bash


S3_BUCKET_NAME=amplify-codebuild/dbbackup/$K8_NAMESPACE

echo "Backing up  current DB version"

pg_dump -f dump-db-$(date +"%FT%T").sql


BACKUP_FILE_NAME=`ls dump*.sql`

echo " Backup file name : $BACKUP_FILE_NAME"

aws s3 cp $BACKUP_FILE_NAME "s3://${S3_BUCKET_NAME}/${BACKUP_FILE_NAME}"

echo "Backup file stored in S3 bucket"

returncode=$?

exit $returncode
