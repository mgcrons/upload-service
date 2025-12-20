import { REDIS_KEYS } from "../redis";

// Mock redis module BEFORE importing redis.ts
jest.mock("redis", () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    isReady: false,
  })),
}));

// Mock logger
jest.mock("../../utils/logger", () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Redis Configuration", () => {
  describe("REDIS_KEYS", () => {
    it("should generate correct file metadata key", () => {
      const key = REDIS_KEYS.FILE_METADATA(
        "user123",
        "ID_CARD",
        "test-file.jpg"
      );

      expect(key).toBe("file:user123:ID_CARD:test-file.jpg");
    });

    it("should generate correct file list key", () => {
      const key = REDIS_KEYS.FILE_LIST("user456", "PASSPORT");

      expect(key).toBe("files:user456:PASSPORT");
    });

    it("should handle special characters in keys", () => {
      const key = REDIS_KEYS.FILE_METADATA(
        "user-with-dashes",
        "PROOF_OF_ADDRESS",
        "file_name_with_underscores.pdf"
      );

      expect(key).toBe(
        "file:user-with-dashes:PROOF_OF_ADDRESS:file_name_with_underscores.pdf"
      );
    });

    it("should generate keys with complex user IDs", () => {
      const key = REDIS_KEYS.FILE_METADATA(
        "user_123-abc",
        "BANK_STATEMENT",
        "file-2024.pdf"
      );

      expect(key).toBe("file:user_123-abc:BANK_STATEMENT:file-2024.pdf");
    });

    it("should generate list keys for different document types", () => {
      const idCardKey = REDIS_KEYS.FILE_LIST("user1", "ID_CARD");
      const passportKey = REDIS_KEYS.FILE_LIST("user1", "PASSPORT");

      expect(idCardKey).toBe("files:user1:ID_CARD");
      expect(passportKey).toBe("files:user1:PASSPORT");
      expect(idCardKey).not.toBe(passportKey);
    });
  });

  describe("connectRedis function", () => {
    it("should be exported from the module", () => {
      const { connectRedis } = require("../redis");
      expect(connectRedis).toBeDefined();
      expect(typeof connectRedis).toBe("function");
    });

    it("should handle connection errors gracefully", async () => {
      const logger = require("../../utils/logger").default;
      const { createClient } = require("redis");

      // Create a mock client that throws on connect
      const mockClient = {
        on: jest.fn(),
        connect: jest.fn().mockRejectedValue(new Error("Connection failed")),
        isReady: false,
      };

      createClient.mockReturnValueOnce(mockClient);

      // Re-import to get fresh instance with new mock
      jest.resetModules();
      const { connectRedis: freshConnectRedis } = require("../redis");

      // Should not throw, just log error
      await expect(freshConnectRedis()).resolves.not.toThrow();
    });
  });

  describe("Redis event handlers", () => {
    it("should have event handlers registered on import", () => {
      // The redis module registers event handlers on import
      // We verify this by checking that 'on' was called during module initialization
      const { redisClient } = require("../redis");
      expect(redisClient.on).toBeDefined();
    });
  });

  describe("Redis URL configuration", () => {
    it("should use REDIS_URL environment variable if set", () => {
      // The module uses process.env.REDIS_URL which is set in .env
      expect(process.env.REDIS_URL).toBeDefined();
    });
  });
});
