import { Request, Response, NextFunction } from "express";
import multer from "multer";
import logger from "../utils/logger";

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * File filter for multer
 * Validates file type and rejects unwanted files
 */
export const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Check MIME type
  if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
    logger.warn("File upload rejected: invalid MIME type", {
      mimetype: file.mimetype,
      filename: file.originalname,
    });
    return cb(
      new Error(
        `Invalid file type. Only images (JPG, PNG) and PDF files are allowed.`
      )
    );
  }

  // Check file extension
  const ext = file.originalname.toLowerCase().split(".").pop();
  const validExtensions = ["jpg", "jpeg", "png", "pdf"];

  if (!ext || !validExtensions.includes(ext)) {
    logger.warn("File upload rejected: invalid extension", {
      extension: ext,
      filename: file.originalname,
    });
    return cb(
      new Error(
        `Invalid file extension. Allowed: ${validExtensions.join(", ")}`
      )
    );
  }

  cb(null, true);
};

/**
 * Middleware to validate uploaded file metadata
 */
export const validateFileMetadata = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    return res.status(400).json({
      error: {
        code: "NO_FILE_UPLOADED",
        message: "No file was uploaded",
      },
    });
  }

  // Validate file size
  if (req.file.size > MAX_FILE_SIZE_BYTES) {
    logger.warn("File upload rejected: size limit exceeded", {
      size: req.file.size,
      limit: MAX_FILE_SIZE_BYTES,
      filename: req.file.originalname,
    });
    return res.status(400).json({
      error: {
        code: "FILE_TOO_LARGE",
        message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
        maxSize: MAX_FILE_SIZE_MB,
      },
    });
  }

  // Validate required metadata
  const { userId, documentType } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: {
        code: "MISSING_USER_ID",
        message: "userId is required",
      },
    });
  }

  if (!documentType) {
    return res.status(400).json({
      error: {
        code: "MISSING_DOCUMENT_TYPE",
        message: "documentType is required",
      },
    });
  }

  const validDocumentTypes = [
    "ID_CARD",
    "PASSPORT",
    "DRIVERS_LICENSE",
    "PROOF_OF_ADDRESS",
    "SELFIE",
  ];

  if (!validDocumentTypes.includes(documentType)) {
    return res.status(400).json({
      error: {
        code: "INVALID_DOCUMENT_TYPE",
        message: `Invalid document type. Allowed: ${validDocumentTypes.join(
          ", "
        )}`,
      },
    });
  }

  next();
};

/**
 * Error handler for multer errors
 */
export const handleMulterError = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    logger.error("Multer error during file upload", {
      code: err.code,
      message: err.message,
      field: err.field,
    });

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: {
          code: "FILE_TOO_LARGE",
          message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
        },
      });
    }

    return res.status(400).json({
      error: {
        code: "UPLOAD_ERROR",
        message: err.message,
      },
    });
  }

  next(err);
};
