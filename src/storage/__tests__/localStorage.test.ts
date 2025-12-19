import fs from "fs";
import path from "path";

// Mock logger BEFORE importing localStorage
jest.mock("../../utils/logger");

// Mock Redis client
jest.mock("../../config/redis", () => ({
  redisClient: {
    isReady: false,
    hSet: jest.fn(),
    sAdd: jest.fn(),
    exists: jest.fn(),
    del: jest.fn(),
    sRem: jest.fn(),
    sMembers: jest.fn(),
    hGetAll: jest.fn(),
  },
  REDIS_KEYS: {
    FILE_METADATA: (userId: string, documentType: string, filename: string) =>
      `file:${userId}:${documentType}:${filename}`,
    FILE_LIST: (userId: string, documentType: string) =>
      `files:${userId}:${documentType}`,
  },
}));

import { LocalStorageManager } from "../localStorage";

describe("LocalStorageManager", () => {
  let storageManager: LocalStorageManager;
  const testUserId = "testuser123";
  const testDocType = "ID_CARD";
  const testUploadDir = path.join(__dirname, "../../../test-uploads");

  beforeAll(() => {
    process.env.UPLOAD_DIR = testUploadDir;
  });

  beforeEach(() => {
    storageManager = new LocalStorageManager();
    // Clean up test directory
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  describe("getFilePath", () => {
    it("should return correct file path", () => {
      const filename = "test-file.jpg";
      const filePath = storageManager.getFilePath(
        testUserId,
        testDocType,
        filename
      );

      const expected = path.join(
        testUploadDir,
        testUserId,
        testDocType,
        filename
      );
      expect(filePath).toBe(expected);
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      // Create test file
      const testDir = path.join(testUploadDir, testUserId, testDocType);
      fs.mkdirSync(testDir, { recursive: true });
      const testFile = path.join(testDir, "exists.jpg");
      fs.writeFileSync(testFile, "test");

      const exists = await storageManager.fileExists(
        testUserId,
        testDocType,
        "exists.jpg"
      );

      expect(exists).toBe(true);
    });

    it("should return false for non-existent file", async () => {
      const exists = await storageManager.fileExists(
        testUserId,
        testDocType,
        "does-not-exist.jpg"
      );

      expect(exists).toBe(false);
    });
  });

  describe("listFiles", () => {
    it("should return empty array for non-existent directory", async () => {
      const files = await storageManager.listFiles(testUserId, testDocType);

      expect(files).toEqual([]);
    });

    it("should list all files in directory", async () => {
      // Create test files
      const testDir = path.join(testUploadDir, testUserId, testDocType);
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "file1.jpg"), "content1");
      fs.writeFileSync(path.join(testDir, "file2.pdf"), "content2");
      fs.writeFileSync(path.join(testDir, "file3.png"), "content3");

      const files = await storageManager.listFiles(testUserId, testDocType);

      expect(files).toHaveLength(3);
      expect(files).toContain("file1.jpg");
      expect(files).toContain("file2.pdf");
      expect(files).toContain("file3.png");
    });
  });

  describe("getFileMetadata", () => {
    it("should return null when Redis is not ready", async () => {
      const metadata = await storageManager.getFileMetadata(
        testUserId,
        testDocType,
        "test.jpg"
      );

      expect(metadata).toBeNull();
    });
  });
});
