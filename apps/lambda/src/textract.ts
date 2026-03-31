import { TextractClient, AnalyzeExpenseCommand } from "@aws-sdk/client-textract";

const textract = new TextractClient({ region: process.env.AWS_REGION || "us-east-1" });

interface ExtractedData {
  merchant: string | null;
  totalAmount: number | null;
  receiptDate: Date | null;
  lineItems: Array<{ description: string; amount: number | null }>;
  rawResponse: any;
}

function findField(fields: any[], targetType: string): string | null {
  for (const field of fields) {
    const fieldType = field.Type?.Text;
    if (fieldType === targetType && field.ValueDetection?.Text) {
      return field.ValueDetection.Text;
    }
  }
  return null;
}

function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(text: string): Date | null {
  const date = new Date(text);
  return isNaN(date.getTime()) ? null : date;
}

export async function analyzeReceipt(bucket: string, key: string): Promise<ExtractedData> {
  const command = new AnalyzeExpenseCommand({
    Document: {
      S3Object: { Bucket: bucket, Name: key },
    },
  });

  const response = await textract.send(command);
  const documents = response.ExpenseDocuments || [];

  let merchant: string | null = null;
  let totalAmount: number | null = null;
  let receiptDate: Date | null = null;
  const lineItems: Array<{ description: string; amount: number | null }> = [];

  for (const doc of documents) {
    const summaryFields = doc.SummaryFields || [];

    const vendorName = findField(summaryFields, "VENDOR_NAME");
    if (vendorName && !merchant) merchant = vendorName;

    const total = findField(summaryFields, "TOTAL");
    if (total && totalAmount === null) totalAmount = parseAmount(total);

    const dateStr = findField(summaryFields, "INVOICE_RECEIPT_DATE");
    if (dateStr && !receiptDate) receiptDate = parseDate(dateStr);

    for (const group of doc.LineItemGroups || []) {
      for (const item of group.LineItems || []) {
        const fields = item.LineItemExpenseFields || [];
        const desc = findField(fields, "ITEM") || findField(fields, "PRODUCT_CODE") || "";
        const price = findField(fields, "PRICE");
        if (desc) {
          lineItems.push({
            description: desc,
            amount: price ? parseAmount(price) : null,
          });
        }
      }
    }
  }

  return {
    merchant,
    totalAmount,
    receiptDate,
    lineItems,
    rawResponse: response,
  };
}
