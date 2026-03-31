import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRouter from "./routes/auth";
import receiptsRouter from "./routes/receipts";
import dashboardRouter from "./routes/dashboard";
import exportRouter from "./routes/export";
import { errorHandler } from "./middleware/errors";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/receipts", receiptsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/export", exportRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
