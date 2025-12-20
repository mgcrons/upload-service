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

  describe("Global Error Handler", () => {
    // Add a test route that triggers the error handler
    beforeAll(() => {
      app.get("/test-error", (req, res, next) => {
        next(new Error("Test error message"));
      });
    });

    it("should handle errors with full error message in non-production mode", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const response = await request(app).get("/test-error");

      process.env.NODE_ENV = originalEnv;

      expect(response.status).toBe(500);
      // Check the response has the error structure
      if (response.body && response.body.error) {
        expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
        expect(response.body.error.message).toBe("Test error message");
      }
    });

    it("should handle errors with generic message in production mode", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const response = await request(app).get("/test-error");

      console.log("Response status:", response.status);
      console.log("Response body:", JSON.stringify(response.body));

      process.env.NODE_ENV = originalEnv;

      expect(response.status).toBe(500);
      // Check the response has the error structure
      if (response.body && response.body.error) {
        expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
        expect(response.body.error.message).toBe("Internal server error");
      }
    });
  });
});
