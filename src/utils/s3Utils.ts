import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../config/s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const bucketName = process.env.AWS_S3_BUCKET_NAME

export const uploadToS3 = async (fileBuffer: Buffer, fileName: string, mimetype: string) => {
    // Handle base64 strings
    if (typeof fileBuffer === 'string') {
        fileBuffer = Buffer.from(fileBuffer, 'base64');
    }

    const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimetype,
    };

    await s3Client.send(new PutObjectCommand(params));
    return fileName;
};

export const getS3Url = async (fileName: string) => {
    const params = {
        Bucket: bucketName,
        Key: fileName
    };

    // Generate URL valid for 1 hour
    return await getSignedUrl(s3Client, new GetObjectCommand(params), { expiresIn: 3600 });
};

export const deleteFromS3 = async (fileName: string) => {
    const params = {
        Bucket: bucketName,
        Key: fileName
    };

    await s3Client.send(new DeleteObjectCommand(params));
};