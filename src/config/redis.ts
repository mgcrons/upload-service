import { createClient, RedisClientType } from "redis";
import logger from "../utils/logger";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379/2";

export const redisClient: RedisClientType = createClient({
  url: redisUrl,
});

redisClient.on("error", (err: Error) => {
  logger.error("Redis Client Error", err);
});

redisClient.on("connect", () => {
  logger.info("Redis Client Connected");
});

redisClient.on("ready", () => {
  logger.info("Redis Client Ready");
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    logger.error("Failed to connect to Redis", err);
    // Don't exit process, allow service to run without Redis
  }
};

/**
 * Redis key patterns for file metadata
 */
export const REDIS_KEYS = {
  // File metadata: file:{userId}:{documentType}:{filename}
  FILE_METADATA: (userId: string, documentType: string, filename: string) =>
    `file:${userId}:${documentType}:${filename}`,

  // File list index: files:{userId}:{documentType}
  FILE_LIST: (userId: string, documentType: string) =>
    `files:${userId}:${documentType}`,
};
