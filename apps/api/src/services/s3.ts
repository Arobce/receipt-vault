import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import path from "path";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET environment variable is not set");
  return bucket;
}

export function generateS3Key(userId: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const uuid = crypto.randomUUID();
  return `uploads/${userId}/${uuid}${ext}`;
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}
