import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { Prisma } from "@prisma/client";

const router = Router();
router.use(authenticate);

// GET /api/export/csv?startDate=...&endDate=...&category=...
router.get("/csv", async (req: Request, res: Response) => {
  const where: Prisma.ReceiptWhereInput = {
    userId: req.userId!,
    deletedAt: null,
    status: "PROCESSED",
  };

  if (req.query.startDate || req.query.endDate) {
    where.receiptDate = {};
    if (req.query.startDate) {
      where.receiptDate.gte = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      where.receiptDate.lte = new Date(req.query.endDate as string);
    }
  }
  if (req.query.category) {
    where.categoryId = req.query.category as string;
  }

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: { receiptDate: { sort: "desc", nulls: "last" } },
    include: { category: true },
  });

  const header = "date,merchant,category,amount,currency";
  const rows = receipts.map((r) => {
    const date = r.receiptDate ? r.receiptDate.toISOString().split("T")[0] : "";
    const merchant = escapeCsv(r.merchant || "");
    const category = escapeCsv(r.category?.name || "");
    const amount = r.totalAmount ? Number(r.totalAmount).toFixed(2) : "";
    return `${date},${merchant},${category},${amount},${r.currency}`;
  });

  const csv = [header, ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="receipts-export.csv"');
  res.send(csv);
});

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default router;
