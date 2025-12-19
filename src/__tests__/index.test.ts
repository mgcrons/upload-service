import request from "supertest";

// Mock logger first
jest.mock("../utils/logger");

// Mock Redis
jest.mock("../config/redis", () => ({
  redisClient: {
    isReady: true,
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
  },
  connectRedis: jest.fn().mockResolvedValue(undefined),
  REDIS_KEYS: {
    FILE_METADATA: (userId: string, documentType: string, filename: string) =>
      `file:${userId}:${documentType}:${filename}`,
    FILE_LIST: (userId: string, documentType: string) =>
      `files:${userId}:${documentType}`,
  },
}));

// Mock storage manager to prevent file system operations
jest.mock("../storage/localStorage");

// Import app after mocks
import app from "../index";

describe("Express App", () => {
  describe("GET /health", () => {
    it("should return healthy status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "healthy",
        service: "upload-service",
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe("CORS", () => {
    it("should include CORS headers", async () => {
      const response = await request(app)
        .get("/health")
        .set("Origin", "http://localhost:3000");

      expect(response.headers["access-control-allow-origin"]).toBeDefined();
    });
  });

  describe("Security Headers", () => {
    it("should include helmet security headers", async () => {
      const response = await request(app).get("/health");

      // Helmet adds various security headers
      expect(response.headers["x-content-type-options"]).toBeDefined();
    });
  });
});
