import { Request, Response, NextFunction } from "express";
import multer from "multer";
import {
  fileFilter,
  validateFileMetadata,
  handleMulterError,
} from "../fileValidation";

describe("fileValidation middleware", () => {
  describe("fileFilter", () => {
    let mockCb: jest.Mock;

    beforeEach(() => {
      mockCb = jest.fn();
    });

    it("should accept valid JPEG image", () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        destination: "/tmp",
        filename: "test.jpg",
        path: "/tmp/test.jpg",
        buffer: Buffer.from(""),
      } as Express.Multer.File;

      fileFilter({} as Request, mockFile, mockCb);

      expect(mockCb).toHaveBeenCalledWith(null, true);
    });

    it("should accept valid PNG image", () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.png",
        encoding: "7bit",
        mimetype: "image/png",
        size: 1024,
        destination: "/tmp",
        filename: "test.png",
        path: "/tmp/test.png",
        buffer: Buffer.from(""),
      } as Express.Multer.File;

      fileFilter({} as Request, mockFile, mockCb);

      expect(mockCb).toHaveBeenCalledWith(null, true);
    });

    it("should accept valid PDF file", () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        size: 1024,
        destination: "/tmp",
        filename: "test.pdf",
        path: "/tmp/test.pdf",
        buffer: Buffer.from(""),
      } as Express.Multer.File;

      fileFilter({} as Request, mockFile, mockCb);

      expect(mockCb).toHaveBeenCalledWith(null, true);
    });

    it("should reject file with invalid MIME type", () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.txt",
        encoding: "7bit",
        mimetype: "text/plain",
        size: 1024,
        destination: "/tmp",
        filename: "test.txt",
        path: "/tmp/test.txt",
        buffer: Buffer.from(""),
      } as Express.Multer.File;

      fileFilter({} as Request, mockFile, mockCb);

      expect(mockCb).toHaveBeenCalledWith(expect.any(Error));
      const error = mockCb.mock.calls[0][0];
      expect(error.message).toContain("Invalid file type");
    });

    it("should reject file with invalid extension", () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.exe",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        destination: "/tmp",
        filename: "test.exe",
        path: "/tmp/test.exe",
        buffer: Buffer.from(""),
      } as Express.Multer.File;

      fileFilter({} as Request, mockFile, mockCb);

      expect(mockCb).toHaveBeenCalledWith(expect.any(Error));
      const error = mockCb.mock.calls[0][0];
      expect(error.message).toContain("Invalid file extension");
    });

    it("should reject file without extension", () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        destination: "/tmp",
        filename: "test",
        path: "/tmp/test",
        buffer: Buffer.from(""),
      } as Express.Multer.File;

      fileFilter({} as Request, mockFile, mockCb);

      expect(mockCb).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("validateFileMetadata", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        file: {
          fieldname: "file",
          originalname: "test.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          destination: "/tmp",
          filename: "test.jpg",
          path: "/tmp/test.jpg",
          buffer: Buffer.from(""),
          stream: {} as any,
        },
        body: {
          userId: "user123",
          documentType: "ID_CARD",
        },
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    it("should pass validation with valid metadata", () => {
      validateFileMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject when no file is uploaded", () => {
      mockReq.file = undefined;

      validateFileMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "NO_FILE_UPLOADED",
          message: "No file was uploaded",
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject when file size exceeds limit", () => {
      mockReq.file!.size = 11 * 1024 * 1024; // 11MB

      validateFileMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "FILE_TOO_LARGE",
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject when userId is missing", () => {
      mockReq.body.userId = undefined;

      validateFileMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "MISSING_USER_ID",
          message: "userId is required",
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject when documentType is missing", () => {
      mockReq.body.documentType = undefined;

      validateFileMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "MISSING_DOCUMENT_TYPE",
          message: "documentType is required",
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject when documentType is invalid", () => {
      mockReq.body.documentType = "INVALID_TYPE";

      validateFileMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INVALID_DOCUMENT_TYPE",
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should accept all valid document types", () => {
      const validTypes = [
        "ID_CARD",
        "PASSPORT",
        "DRIVERS_LICENSE",
        "PROOF_OF_ADDRESS",
        "SELFIE",
      ];

      validTypes.forEach((type) => {
        mockReq.body.documentType = type;
        mockNext = jest.fn();

        validateFileMetadata(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  describe("handleMulterError", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    it("should handle LIMIT_FILE_SIZE error", () => {
      const multerError = new multer.MulterError("LIMIT_FILE_SIZE", "file");

      handleMulterError(
        multerError,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "FILE_TOO_LARGE",
          message: expect.stringContaining("10MB"),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle other multer errors", () => {
      const multerError = new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "wrongField"
      );

      handleMulterError(
        multerError,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "UPLOAD_ERROR",
          message: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle file filter errors as validation errors", () => {
      const fileFilterError = new Error(
        "Invalid file type. Only images (JPG, PNG) and PDF files are allowed."
      );

      handleMulterError(
        fileFilterError,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "INVALID_FILE",
          message:
            "Invalid file type. Only images (JPG, PNG) and PDF files are allowed.",
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
