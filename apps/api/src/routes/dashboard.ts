import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errors";

const router = Router();
router.use(authenticate);

// GET /api/dashboard/summary?period=month&date=2026-03
router.get("/summary", async (req: Request, res: Response) => {
  const period = (req.query.period as string) || "month";
  const dateParam = req.query.date as string;

  let startDate: Date;
  let endDate: Date;

  if (period === "year") {
    const year = dateParam ? parseInt(dateParam) : new Date().getFullYear();
    startDate = new Date(year, 0, 1);
    endDate = new Date(year + 1, 0, 1);
  } else {
    // Default to month
    let year: number;
    let month: number;

    if (dateParam && dateParam.includes("-")) {
      const parts = dateParam.split("-");
      year = parseInt(parts[0]);
      month = parseInt(parts[1]) - 1;
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth();
    }

    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 1);
  }

  const where = {
    userId: req.userId!,
    deletedAt: null,
    status: "PROCESSED" as const,
    receiptDate: { gte: startDate, lt: endDate },
  };

  const [receipts, categoryBreakdown] = await Promise.all([
    prisma.receipt.findMany({
      where,
      select: {
        totalAmount: true,
        receiptDate: true,
        category: { select: { name: true, icon: true } },
      },
    }),
    prisma.receipt.groupBy({
      by: ["categoryId"],
      where,
      _sum: { totalAmount: true },
      _count: true,
    }),
  ]);

  const totalSpent = receipts.reduce(
    (sum, r) => sum + (r.totalAmount ? Number(r.totalAmount) : 0),
    0
  );

  // Build daily totals
  const dailyMap = new Map<string, number>();
  for (const r of receipts) {
    if (r.receiptDate && r.totalAmount) {
      const day = r.receiptDate.toISOString().split("T")[0];
      dailyMap.set(day, (dailyMap.get(day) || 0) + Number(r.totalAmount));
    }
  }
  const dailyTotals = Array.from(dailyMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Resolve category names for breakdown
  const categoryIds = categoryBreakdown
    .map((g) => g.categoryId)
    .filter((id): id is string => id !== null);

  const categories = categoryIds.length
    ? await prisma.category.findMany({ where: { id: { in: categoryIds } } })
    : [];

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const breakdown = categoryBreakdown.map((g) => {
    const cat = g.categoryId ? categoryMap.get(g.categoryId) : null;
    return {
      category: cat?.name || "Uncategorized",
      icon: cat?.icon || null,
      total: Number(g._sum.totalAmount || 0),
      count: g._count,
    };
  });

  res.json({
    totalSpent,
    receiptCount: receipts.length,
    categoryBreakdown: breakdown,
    dailyTotals,
  });
});

export default router;
