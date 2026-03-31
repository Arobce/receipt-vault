import { S3Event } from "aws-lambda";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { analyzeReceipt } from "./textract";
import { categorizeMerchant } from "./categorize";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export async function handler(event: S3Event): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    // Extract receipt ID from key: uploads/{userId}/{uuid}.ext
    const receipt = await prisma.receipt.findFirst({
      where: { s3Key: key },
    });

    if (!receipt) {
      console.error(`No receipt found for S3 key: ${key}`);
      continue;
    }

    try {
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { status: "PROCESSING" },
      });

      const extracted = await analyzeReceipt(bucket, key);

      let categoryId: string | null = null;
      if (extracted.merchant) {
        const categoryName = categorizeMerchant(extracted.merchant);
        const category = await prisma.category.findUnique({
          where: { name: categoryName },
        });
        if (category) categoryId = category.id;
      }

      await prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          merchant: extracted.merchant,
          totalAmount: extracted.totalAmount,
          receiptDate: extracted.receiptDate,
          lineItems: extracted.lineItems as any,
          rawTextract: extracted.rawResponse as any,
          categoryId,
          status: "PROCESSED",
        },
      });

      console.log(`Processed receipt ${receipt.id}: ${extracted.merchant} - $${extracted.totalAmount}`);
    } catch (error) {
      console.error(`Failed to process receipt ${receipt.id}:`, error);

      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { status: "FAILED" },
      });
    }
  }
}
