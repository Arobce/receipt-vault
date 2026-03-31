import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errors";

export function validate(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((e: z.ZodIssue) => e.message).join(", ");
      throw new AppError(400, message);
    }
    req.body = result.data;
    next();
  };
}

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(100),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const updateReceiptSchema = z.object({
  merchant: z.string().nullable().optional(),
  totalAmount: z.number().positive().nullable().optional(),
  receiptDate: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});
