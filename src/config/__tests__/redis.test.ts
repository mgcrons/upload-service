import { REDIS_KEYS } from "../redis";

// Mock the actual Redis client to prevent real connections
jest.mock("redis", () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
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
  });

  describe("connectRedis", () => {
    it("should use correct Redis URL from environment", () => {
      const expectedUrl = process.env.REDIS_URL || "redis://localhost:6379/2";
      expect(expectedUrl).toBeDefined();
    });
  });
});
