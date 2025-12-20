import request from "supertest";
import express from "express";
import fs from "fs";
import path from "path";
import uploadRoutes from "../upload";

// Mock storage manager
const mockStoreFile = jest.fn();
const mockFileExists = jest.fn();
const mockGetFilePath = jest.fn();
const mockDeleteFile = jest.fn();
const mockListFiles = jest.fn();

jest.mock("../../storage/localStorage", () => ({
  storageManager: {
    storeFile: (...args: any[]) => mockStoreFile(...args),
    fileExists: (...args: any[]) => mockFileExists(...args),
    getFilePath: (...args: any[]) => mockGetFilePath(...args),
    deleteFile: (...args: any[]) => mockDeleteFile(...args),
    listFiles: (...args: any[]) => mockListFiles(...args),
  },
}));

// Mock logger
jest.mock("../../utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("Upload Routes", () => {
  let app: express.Application;
  const testUploadDir = path.join(__dirname, "../../../test-uploads");

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(uploadRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testUploadDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  describe("POST /upload", () => {
    it("should successfully upload a file", async () => {
      const mockMetadata = {
        filename: "uuid-123.jpg",
        originalName: "test-document.jpg",
        path: "/path/to/file.jpg",
        size: 1024,
        mimetype: "image/jpeg",
        hash: "abc123hash",
        url: "/files/user123/ID_CARD/uuid-123.jpg",
      };

      mockStoreFile.mockResolvedValue(mockMetadata);

      const testFilePath = path.join(testUploadDir, "test-file.jpg");
      fs.writeFileSync(testFilePath, "test image content");

      const response = await request(app)
        .post("/upload")
        .field("userId", "user123")
        .field("documentType", "ID_CARD")
        .attach("file", testFilePath);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          filename: "uuid-123.jpg",
          originalName: "test-document.jpg",
          size: 1024,
          mimetype: "image/jpeg",
          hash: "abc123hash",
          url: "/files/user123/ID_CARD/uuid-123.jpg",
        },
      });
      expect(mockStoreFile).toHaveBeenCalled();
    });

    it("should reject upload without file", async () => {
      const response = await request(app)
        .post("/upload")
        .field("userId", "user123")
        .field("documentType", "ID_CARD");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("NO_FILE_UPLOADED");
    });

    it("should reject upload without userId", async () => {
      const testFilePath = path.join(testUploadDir, "test.jpg");
      fs.writeFileSync(testFilePath, "content");

      const response = await request(app)
        .post("/upload")
        .field("documentType", "ID_CARD")
        .attach("file", testFilePath);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MISSING_USER_ID");
    });

    it("should reject upload without documentType", async () => {
      const testFilePath = path.join(testUploadDir, "test.jpg");
      fs.writeFileSync(testFilePath, "content");

      const response = await request(app)
        .post("/upload")
        .field("userId", "user123")
        .attach("file", testFilePath);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MISSING_DOCUMENT_TYPE");
    });

    it("should reject invalid document type", async () => {
      const testFilePath = path.join(testUploadDir, "test.jpg");
      fs.writeFileSync(testFilePath, "content");

      const response = await request(app)
        .post("/upload")
        .field("userId", "user123")
        .field("documentType", "INVALID_TYPE")
        .attach("file", testFilePath);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_DOCUMENT_TYPE");
    });

    it("should reject invalid file type", async () => {
      const testFilePath = path.join(testUploadDir, "test.txt");
      fs.writeFileSync(testFilePath, "text content");

      const response = await request(app)
        .post("/upload")
        .field("userId", "user123")
        .field("documentType", "ID_CARD")
        .attach("file", testFilePath);

      expect(response.status).toBe(400);
    });

    it("should handle storage errors", async () => {
      mockStoreFile.mockRejectedValue(new Error("Storage error"));

      const testFilePath = path.join(testUploadDir, "test.jpg");
      fs.writeFileSync(testFilePath, "content");

      const response = await request(app)
        .post("/upload")
        .field("userId", "user123")
        .field("documentType", "ID_CARD")
        .attach("file", testFilePath);

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("UPLOAD_FAILED");
    });
  });

  describe("GET /files/:userId/:documentType/:filename", () => {
    it("should serve an existing file", async () => {
      const testFile = path.join(testUploadDir, "serve-test.jpg");
      fs.writeFileSync(testFile, "file content");

      mockFileExists.mockResolvedValue(true);
      mockGetFilePath.mockReturnValue(testFile);

      const response = await request(app).get(
        "/files/user123/ID_CARD/serve-test.jpg"
      );

      expect(response.status).toBe(200);
      expect(mockFileExists).toHaveBeenCalledWith(
        "user123",
        "ID_CARD",
        "serve-test.jpg"
      );
    });

    it("should return 404 for non-existent file", async () => {
      mockFileExists.mockResolvedValue(false);

      const response = await request(app).get(
        "/files/user123/ID_CARD/nonexistent.jpg"
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("FILE_NOT_FOUND");
    });

    it("should handle sendFile errors", async () => {
      // Create a file path that will cause sendFile to fail
      const invalidPath = path.join(
        testUploadDir,
        "invalid/../../../etc/passwd"
      );

      mockFileExists.mockResolvedValue(true);
      mockGetFilePath.mockReturnValue(invalidPath);

      const response = await request(app).get(
        "/files/user123/ID_CARD/malicious.jpg"
      );

      // Should return 500 if sendFile fails
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("FILE_SERVE_ERROR");
    });
  });

  describe("DELETE /files/:userId/:documentType/:filename", () => {
    it("should delete a file successfully", async () => {
      mockDeleteFile.mockResolvedValue(undefined);

      const response = await request(app).delete(
        "/files/user123/ID_CARD/to-delete.jpg"
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: "File deleted successfully",
      });
      expect(mockDeleteFile).toHaveBeenCalledWith(
        "user123",
        "ID_CARD",
        "to-delete.jpg"
      );
    });

    it("should handle deletion errors", async () => {
      mockDeleteFile.mockRejectedValue(new Error("Deletion failed"));

      const response = await request(app).delete(
        "/files/user123/ID_CARD/error-file.jpg"
      );

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("DELETE_FAILED");
    });
  });

  describe("GET /files/:userId/:documentType", () => {
    it("should list files for user and document type", async () => {
      const mockFiles = ["file1.jpg", "file2.pdf", "file3.png"];
      mockListFiles.mockResolvedValue(mockFiles);

      const response = await request(app).get("/files/user123/ID_CARD");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        data: {
          files: mockFiles,
          count: 3,
        },
      });
      expect(mockListFiles).toHaveBeenCalledWith("user123", "ID_CARD");
    });

    it("should return empty list when no files exist", async () => {
      mockListFiles.mockResolvedValue([]);

      const response = await request(app).get("/files/user456/PASSPORT");

      expect(response.status).toBe(200);
      expect(response.body.data.files).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });

    it("should handle listing errors", async () => {
      mockListFiles.mockRejectedValue(new Error("List error"));

      const response = await request(app).get("/files/user123/ID_CARD");

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("LIST_FAILED");
    });
  });
});
