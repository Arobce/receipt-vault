import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { generateS3Key, uploadToS3, getPresignedUrl } from "../services/s3";
import { AppError } from "../middleware/errors";
import { Prisma } from "@prisma/client";

const router = Router();
router.use(authenticate);

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// POST /api/receipts/upload
router.post("/upload", upload.single("receipt"), async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(400, "No file uploaded");
  }

  const s3Key = generateS3Key(req.userId!, req.file.originalname);

  await uploadToS3(s3Key, req.file.buffer, req.file.mimetype);

  const receipt = await prisma.receipt.create({
    data: {
      userId: req.userId!,
      s3Key,
      originalName: req.file.originalname,
      status: "PENDING",
    },
    select: {
      id: true,
      s3Key: true,
      originalName: true,
      status: true,
      createdAt: true,
    },
  });

  res.status(201).json(receipt);
});

// GET /api/receipts
router.get("/", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.ReceiptWhereInput = {
    userId: req.userId!,
    deletedAt: null,
  };

  if (req.query.category) {
    where.categoryId = req.query.category as string;
  }
  if (req.query.startDate || req.query.endDate) {
    where.receiptDate = {};
    if (req.query.startDate) {
      where.receiptDate.gte = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      where.receiptDate.lte = new Date(req.query.endDate as string);
    }
  }
  if (req.query.minAmount || req.query.maxAmount) {
    where.totalAmount = {};
    if (req.query.minAmount) {
      where.totalAmount.gte = parseFloat(req.query.minAmount as string);
    }
    if (req.query.maxAmount) {
      where.totalAmount.lte = parseFloat(req.query.maxAmount as string);
    }
  }
  if (req.query.search) {
    where.merchant = { contains: req.query.search as string, mode: "insensitive" };
  }

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      skip,
      take: limit,
      orderBy: { receiptDate: { sort: "desc", nulls: "last" } },
      include: { category: true },
    }),
    prisma.receipt.count({ where }),
  ]);

  res.json({
    receipts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/receipts/:id
router.get("/:id", async (req: Request, res: Response) => {
  const receipt = await prisma.receipt.findUnique({
    where: { id: param(req, "id") },
    include: { category: true },
  });

  if (!receipt || receipt.deletedAt) {
    throw new AppError(404, "Receipt not found");
  }
  if (receipt.userId !== req.userId) {
    throw new AppError(403, "Forbidden");
  }

  const imageUrl = await getPresignedUrl(receipt.s3Key);

  res.json({ ...receipt, imageUrl });
});

// PUT /api/receipts/:id
router.put("/:id", async (req: Request, res: Response) => {
  const existing = await prisma.receipt.findUnique({
    where: { id: param(req, "id") },
  });

  if (!existing || existing.deletedAt) {
    throw new AppError(404, "Receipt not found");
  }
  if (existing.userId !== req.userId) {
    throw new AppError(403, "Forbidden");
  }

  const { merchant, totalAmount, receiptDate, categoryId } = req.body;

  const receipt = await prisma.receipt.update({
    where: { id: param(req, "id") },
    data: {
      ...(merchant !== undefined && { merchant }),
      ...(totalAmount !== undefined && { totalAmount }),
      ...(receiptDate !== undefined && { receiptDate: new Date(receiptDate) }),
      ...(categoryId !== undefined && { categoryId }),
      isEdited: true,
    },
    include: { category: true },
  });

  res.json(receipt);
});

// DELETE /api/receipts/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const existing = await prisma.receipt.findUnique({
    where: { id: param(req, "id") },
  });

  if (!existing || existing.deletedAt) {
    throw new AppError(404, "Receipt not found");
  }
  if (existing.userId !== req.userId) {
    throw new AppError(403, "Forbidden");
  }

  await prisma.receipt.update({
    where: { id: param(req, "id") },
    data: { deletedAt: new Date() },
  });

  res.status(204).send();
});

export default router;
