import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { config } from "dotenv";
import uploadRoutes from "./routes/upload";
import logger from "./utils/logger";
import { connectRedis, redisClient } from "./config/redis";

// Load environment variables
config();

const app = express();
const PORT = process.env.UPLOAD_SERVICE_PORT || 5002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info("Incoming request", {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "upload-service",
    timestamp: new Date().toISOString(),
    redis: redisClient.isReady ? "connected" : "disconnected",
  });
});

// Routes
app.use(uploadRoutes);

// Error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error", {
      error: err.message,
      stack: err.stack,
      path: req.path,
    });

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
      },
    });
  }
);

// Initialize Redis and start server
(async () => {
  await connectRedis();

  app.listen(PORT, () => {
    logger.info(`Upload service started`, {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
    });
  });
})();

export default app as express.Application;
