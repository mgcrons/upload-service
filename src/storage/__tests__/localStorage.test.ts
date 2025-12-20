import fs from "fs";
import path from "path";

// Mock logger BEFORE importing localStorage
jest.mock("../../utils/logger");

// Create mock functions
const mockHSet = jest.fn();
const mockSAdd = jest.fn();
const mockExists = jest.fn();
const mockDel = jest.fn();
const mockSRem = jest.fn();
const mockSMembers = jest.fn();
const mockHGetAll = jest.fn();

// Mock Redis client with default state
const mockRedisClient = {
  isReady: false,
  hSet: mockHSet,
  sAdd: mockSAdd,
  exists: mockExists,
  del: mockDel,
  sRem: mockSRem,
  sMembers: mockSMembers,
  hGetAll: mockHGetAll,
};

jest.mock("../../config/redis", () => ({
  redisClient: mockRedisClient,
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
    jest.clearAllMocks();
    mockRedisClient.isReady = false; // Default to disabled

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

  describe("storeFile", () => {
    it("should store file without Redis", async () => {
      const mockFile = {
        path: "/tmp/test-upload.jpg",
        originalname: "document.jpg",
        size: 1024,
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      // Create temp file
      fs.mkdirSync(path.dirname(mockFile.path), { recursive: true });
      fs.writeFileSync(mockFile.path, "test content");

      const metadata = await storageManager.storeFile(
        mockFile,
        testUserId,
        testDocType
      );

      // Verify metadata
      expect(metadata.originalName).toBe("document.jpg");
      expect(metadata.size).toBe(1024);
      expect(metadata.mimetype).toBe("image/jpeg");
      expect(metadata.filename).toMatch(/^[a-f0-9-]+\.jpg$/);
      expect(metadata.hash).toBeDefined();
      expect(metadata.url).toContain(`/files/${testUserId}/${testDocType}/`);

      // Verify file exists
      expect(fs.existsSync(metadata.path)).toBe(true);

      // Verify Redis NOT called
      expect(mockHSet).not.toHaveBeenCalled();
      expect(mockSAdd).not.toHaveBeenCalled();
    });

    it("should store file with Redis metadata when Redis is ready", async () => {
      mockRedisClient.isReady = true;
      mockHSet.mockResolvedValue(1);
      mockSAdd.mockResolvedValue(1);

      const mockFile = {
        path: "/tmp/test-upload-redis.jpg",
        originalname: "redis-doc.jpg",
        size: 2048,
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      fs.mkdirSync(path.dirname(mockFile.path), { recursive: true });
      fs.writeFileSync(mockFile.path, "redis test content");

      const metadata = await storageManager.storeFile(
        mockFile,
        testUserId,
        testDocType
      );

      // Verify Redis calls
      expect(mockHSet).toHaveBeenCalledWith(
        expect.stringContaining(`file:${testUserId}:${testDocType}:`),
        expect.objectContaining({
          filename: metadata.filename,
          originalName: "redis-doc.jpg",
          size: "2048",
          mimetype: "image/jpeg",
          hash: expect.any(String),
          url: metadata.url,
          uploadedAt: expect.any(String),
        })
      );

      expect(mockSAdd).toHaveBeenCalledWith(
        `files:${testUserId}:${testDocType}`,
        metadata.filename
      );
    });

    it("should handle Redis errors gracefully and still upload file", async () => {
      mockRedisClient.isReady = true;
      mockHSet.mockRejectedValue(new Error("Redis connection failed"));

      const mockFile = {
        path: "/tmp/test-redis-error.jpg",
        originalname: "error-doc.jpg",
        size: 512,
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      fs.mkdirSync(path.dirname(mockFile.path), { recursive: true });
      fs.writeFileSync(mockFile.path, "error test");

      // Should NOT throw
      const metadata = await storageManager.storeFile(
        mockFile,
        testUserId,
        testDocType
      );

      // File should still be uploaded
      expect(metadata).toBeDefined();
      expect(fs.existsSync(metadata.path)).toBe(true);
    });

    it("should create directory structure if it doesn't exist", async () => {
      const mockFile = {
        path: "/tmp/test-mkdir.jpg",
        originalname: "new-dir.jpg",
        size: 256,
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      fs.mkdirSync(path.dirname(mockFile.path), { recursive: true });
      fs.writeFileSync(mockFile.path, "mkdir test");

      const expectedDir = path.join(testUploadDir, testUserId, testDocType);
      expect(fs.existsSync(expectedDir)).toBe(false);

      await storageManager.storeFile(mockFile, testUserId, testDocType);

      // Directory should now exist
      expect(fs.existsSync(expectedDir)).toBe(true);
    });

    it("should generate unique filenames with UUID", async () => {
      const mockFile = {
        path: "/tmp/test-uuid.jpg",
        originalname: "original.jpg",
        size: 100,
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      fs.mkdirSync(path.dirname(mockFile.path), { recursive: true });
      fs.writeFileSync(mockFile.path, "uuid test");

      const metadata = await storageManager.storeFile(
        mockFile,
        testUserId,
        testDocType
      );

      // Should match UUID v4 pattern
      expect(metadata.filename).toMatch(
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.jpg$/
      );
    });

    it("should calculate file hash correctly", async () => {
      const testContent = "known content for hashing";
      const mockFile = {
        path: "/tmp/test-hash.jpg",
        originalname: "hash.jpg",
        size: testContent.length,
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      fs.mkdirSync(path.dirname(mockFile.path), { recursive: true });
      fs.writeFileSync(mockFile.path, testContent);

      const metadata = await storageManager.storeFile(
        mockFile,
        testUserId,
        testDocType
      );

      // Hash should be SHA-256 hex (64 chars)
      expect(metadata.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(metadata.hash).toBeDefined();

      // Verify hash is consistent for the same content
      const fileContent = fs.readFileSync(metadata.path);
      const crypto = require("crypto");
      const expectedHash = crypto
        .createHash("sha256")
        .update(fileContent)
        .digest("hex");
      expect(metadata.hash).toBe(expectedHash);
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file (filesystem only)", async () => {
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

    it("should check Redis first when available", async () => {
      mockRedisClient.isReady = true;
      mockExists.mockResolvedValue(1); // File exists in Redis

      const exists = await storageManager.fileExists(
        testUserId,
        testDocType,
        "redis-file.jpg"
      );

      expect(exists).toBe(true);
      expect(mockExists).toHaveBeenCalledWith(
        `file:${testUserId}:${testDocType}:redis-file.jpg`
      );
    });

    it("should fallback to filesystem when Redis check fails", async () => {
      mockRedisClient.isReady = true;
      mockExists.mockRejectedValue(new Error("Redis error"));

      const testDir = path.join(testUploadDir, testUserId, testDocType);
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "fallback.jpg"), "test");

      const exists = await storageManager.fileExists(
        testUserId,
        testDocType,
        "fallback.jpg"
      );

      // Should still return true via filesystem
      expect(exists).toBe(true);
    });
  });

  describe("deleteFile", () => {
    it("should delete file from filesystem only when Redis disabled", async () => {
      const testDir = path.join(testUploadDir, testUserId, testDocType);
      fs.mkdirSync(testDir, { recursive: true });
      const testFile = path.join(testDir, "delete-me.jpg");
      fs.writeFileSync(testFile, "to delete");

      await storageManager.deleteFile(testUserId, testDocType, "delete-me.jpg");

      expect(fs.existsSync(testFile)).toBe(false);
      expect(mockDel).not.toHaveBeenCalled();
      expect(mockSRem).not.toHaveBeenCalled();
    });

    it("should delete file from both filesystem and Redis", async () => {
      mockRedisClient.isReady = true;
      mockDel.mockResolvedValue(1);
      mockSRem.mockResolvedValue(1);

      const testDir = path.join(testUploadDir, testUserId, testDocType);
      fs.mkdirSync(testDir, { recursive: true });
      const testFile = path.join(testDir, "redis-delete.jpg");
      fs.writeFileSync(testFile, "redis delete");

      await storageManager.deleteFile(
        testUserId,
        testDocType,
        "redis-delete.jpg"
      );

      expect(fs.existsSync(testFile)).toBe(false);
      expect(mockDel).toHaveBeenCalledWith(
        `file:${testUserId}:${testDocType}:redis-delete.jpg`
      );
      expect(mockSRem).toHaveBeenCalledWith(
        `files:${testUserId}:${testDocType}`,
        "redis-delete.jpg"
      );
    });

    it("should handle non-existent file gracefully", async () => {
      // Should not throw
      await expect(
        storageManager.deleteFile(testUserId, testDocType, "nonexistent.jpg")
      ).resolves.not.toThrow();
    });

    it("should handle Redis deletion errors gracefully", async () => {
      mockRedisClient.isReady = true;
      mockDel.mockRejectedValue(new Error("Redis delete failed"));

      const testDir = path.join(testUploadDir, testUserId, testDocType);
      fs.mkdirSync(testDir, { recursive: true });
      const testFile = path.join(testDir, "error-delete.jpg");
      fs.writeFileSync(testFile, "error");

      // Should not throw
      await expect(
        storageManager.deleteFile(testUserId, testDocType, "error-delete.jpg")
      ).resolves.not.toThrow();

      // Filesystem deletion should still succeed
      expect(fs.existsSync(testFile)).toBe(false);
    });
  });

  describe("listFiles", () => {
    it("should return empty array for non-existent directory", async () => {
      const files = await storageManager.listFiles(testUserId, testDocType);
      expect(files).toEqual([]);
    });

    it("should list all files in directory (filesystem)", async () => {
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

    it("should list files from Redis when available", async () => {
      mockRedisClient.isReady = true;
      mockSMembers.mockResolvedValue(["redis1.jpg", "redis2.pdf"]);

      const files = await storageManager.listFiles(testUserId, testDocType);

      expect(files).toEqual(["redis1.jpg", "redis2.pdf"]);
      expect(mockSMembers).toHaveBeenCalledWith(
        `files:${testUserId}:${testDocType}`
      );
    });

    it("should fallback to filesystem when Redis returns empty", async () => {
      mockRedisClient.isReady = true;
      mockSMembers.mockResolvedValue([]);

      const testDir = path.join(testUploadDir, testUserId, testDocType);
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "fallback.jpg"), "test");

      const files = await storageManager.listFiles(testUserId, testDocType);

      expect(files).toContain("fallback.jpg");
    });

    it("should fallback to filesystem when Redis fails", async () => {
      mockRedisClient.isReady = true;
      mockSMembers.mockRejectedValue(new Error("Redis error"));

      const testDir = path.join(testUploadDir, testUserId, testDocType);
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "error-fallback.jpg"), "test");

      const files = await storageManager.listFiles(testUserId, testDocType);

      expect(files).toContain("error-fallback.jpg");
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

    it("should retrieve metadata from Redis", async () => {
      mockRedisClient.isReady = true;
      mockHGetAll.mockResolvedValue({
        filename: "uuid-123.jpg",
        originalName: "original.jpg",
        path: "/path/to/file.jpg",
        size: "1024",
        mimetype: "image/jpeg",
        hash: "abc123",
        url: "/files/user/doc/file.jpg",
      });

      const metadata = await storageManager.getFileMetadata(
        testUserId,
        testDocType,
        "uuid-123.jpg"
      );

      expect(metadata).toEqual({
        filename: "uuid-123.jpg",
        originalName: "original.jpg",
        path: "/path/to/file.jpg",
        size: 1024,
        mimetype: "image/jpeg",
        hash: "abc123",
        url: "/files/user/doc/file.jpg",
      });
    });

    it("should return null for empty metadata", async () => {
      mockRedisClient.isReady = true;
      mockHGetAll.mockResolvedValue({});

      const metadata = await storageManager.getFileMetadata(
        testUserId,
        testDocType,
        "empty.jpg"
      );

      expect(metadata).toBeNull();
    });

    it("should return null on Redis error", async () => {
      mockRedisClient.isReady = true;
      mockHGetAll.mockRejectedValue(new Error("Redis error"));

      const metadata = await storageManager.getFileMetadata(
        testUserId,
        testDocType,
        "error.jpg"
      );

      expect(metadata).toBeNull();
    });
  });
});
