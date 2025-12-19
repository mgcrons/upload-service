import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  fileFilter,
  validateFileMetadata,
  handleMulterError,
} from "../middleware/fileValidation";
import { storageManager } from "../storage/localStorage";
import logger from "../utils/logger";

const router: Router = Router();

// Configure multer for temporary storage
const upload = multer({
  dest: "/tmp/uploads",
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * POST /upload
 * Upload a file
 */
router.post(
  "/upload",
  upload.single("file"),
  handleMulterError,
  validateFileMetadata,
  async (req: Request, res: Response) => {
    try {
      const { userId, documentType } = req.body;
      const file = req.file!;

      logger.info("File upload requested", {
        userId,
        documentType,
        filename: file.originalname,
        size: file.size,
      });

      // Store file
      const metadata = await storageManager.storeFile(
        file,
        userId,
        documentType
      );

      res.json({
        success: true,
        data: {
          filename: metadata.filename,
          originalName: metadata.originalName,
          size: metadata.size,
          mimetype: metadata.mimetype,
          hash: metadata.hash,
          url: metadata.url,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("File upload failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: {
          code: "UPLOAD_FAILED",
          message: "Failed to upload file",
        },
      });
    }
  }
);

/**
 * GET /files/:userId/:documentType/:filename
 * Serve uploaded file
 */
router.get(
  "/files/:userId/:documentType/:filename",
  async (req: Request, res: Response) => {
    try {
      const { userId, documentType, filename } = req.params;

      // Check if file exists
      const exists = await storageManager.fileExists(
        userId,
        documentType,
        filename
      );
      if (!exists) {
        return res.status(404).json({
          error: {
            code: "FILE_NOT_FOUND",
            message: "File not found",
          },
        });
      }

      // Get file path
      const filePath = storageManager.getFilePath(
        userId,
        documentType,
        filename
      );

      // Send file
      res.sendFile(filePath, (err) => {
        if (err) {
          logger.error("Error sending file", {
            userId,
            documentType,
            filename,
            error: err.message,
          });
          res.status(500).json({
            error: {
              code: "FILE_SERVE_ERROR",
              message: "Failed to serve file",
            },
          });
        }
      });
    } catch (error) {
      logger.error("Error serving file", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: {
          code: "FILE_SERVE_ERROR",
          message: "Failed to serve file",
        },
      });
    }
  }
);

/**
 * DELETE /files/:userId/:documentType/:filename
 * Delete uploaded file (admin/internal only)
 */
router.delete(
  "/files/:userId/:documentType/:filename",
  async (req: Request, res: Response) => {
    try {
      const { userId, documentType, filename } = req.params;

      logger.info("File deletion requested", {
        userId,
        documentType,
        filename,
      });

      await storageManager.deleteFile(userId, documentType, filename);

      res.json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      logger.error("File deletion failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: {
          code: "DELETE_FAILED",
          message: "Failed to delete file",
        },
      });
    }
  }
);

/**
 * GET /files/:userId/:documentType
 * List files for user and document type
 */
router.get(
  "/files/:userId/:documentType",
  async (req: Request, res: Response) => {
    try {
      const { userId, documentType } = req.params;

      const files = await storageManager.listFiles(userId, documentType);

      res.json({
        data: {
          files,
          count: files.length,
        },
      });
    } catch (error) {
      logger.error("File listing failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: {
          code: "LIST_FAILED",
          message: "Failed to list files",
        },
      });
    }
  }
);

export default router;
