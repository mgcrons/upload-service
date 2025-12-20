import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import logger from "../utils/logger";
import { redisClient, REDIS_KEYS } from "../config/redis";

// Ensure UPLOAD_BASE_DIR is always an absolute path
// This is critical for:
// 1. res.sendFile() which requires absolute paths
// 2. Coolify persistent storage mapping (must map to absolute path in container)
const UPLOAD_BASE_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads")
);

export interface FileMetadata {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimetype: string;
  hash: string;
  url: string;
}

/**
 * Local storage manager for uploaded files
 * Organizes files by userId and documentType
 */
export class LocalStorageManager {
  /**
   * Ensure upload directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info("Created directory", { path: dirPath });
    }
  }

  /**
   * Log upload configuration (called once on first file operation)
   */
  private static configLogged = false;
  private logUploadConfig(): void {
    if (!LocalStorageManager.configLogged) {
      logger.info("Upload storage configuration", {
        uploadBaseDir: UPLOAD_BASE_DIR,
        isAbsolute: path.isAbsolute(UPLOAD_BASE_DIR),
      });
      LocalStorageManager.configLogged = true;
    }
  }

  /**
   * Generate secure filename
   */
  private generateFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const uuid = uuidv4();
    return `${uuid}${ext}`;
  }

  /**
   * Calculate file hash (SHA-256)
   */
  private calculateFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash("sha256");
    hashSum.update(fileBuffer);
    return hashSum.digest("hex");
  }

  /**
   * Get storage path for user's document
   */
  private getStoragePath(userId: string, documentType: string): string {
    return path.join(UPLOAD_BASE_DIR, userId, documentType);
  }

  /**
   * Store uploaded file
   */
  async storeFile(
    file: Express.Multer.File,
    userId: string,
    documentType: string
  ): Promise<FileMetadata> {
    try {
      // Log configuration once
      this.logUploadConfig();

      // Create directory structure
      const storagePath = this.getStoragePath(userId, documentType);
      this.ensureDirectoryExists(storagePath);

      // Generate secure filename
      const filename = this.generateFilename(file.originalname);
      const filePath = path.join(storagePath, filename);

      // Move file to permanent location
      // Use copy + unlink instead of rename to support cross-filesystem moves
      // (e.g., from /tmp to mounted volume in Docker/Coolify)
      try {
        fs.copyFileSync(file.path, filePath);
        fs.unlinkSync(file.path);
      } catch (moveError) {
        // Clean up destination file if copy succeeded but unlink failed
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        throw moveError;
      }

      // Calculate file hash
      const hash = this.calculateFileHash(filePath);

      // Generate public URL
      const url = `/files/${userId}/${documentType}/${filename}`;

      const metadata: FileMetadata = {
        filename,
        originalName: file.originalname,
        path: filePath,
        size: file.size,
        mimetype: file.mimetype,
        hash,
        url,
      };

      // Store metadata in Redis
      if (redisClient.isReady) {
        try {
          const redisKey = REDIS_KEYS.FILE_METADATA(
            userId,
            documentType,
            filename
          );
          const fileListKey = REDIS_KEYS.FILE_LIST(userId, documentType);

          await redisClient.hSet(redisKey, {
            filename: metadata.filename,
            originalName: metadata.originalName,
            path: metadata.path,
            size: metadata.size.toString(),
            mimetype: metadata.mimetype,
            hash: metadata.hash,
            url: metadata.url,
            uploadedAt: new Date().toISOString(),
          });

          // Add to file list set
          await redisClient.sAdd(fileListKey, filename);

          logger.info("File metadata stored in Redis", {
            userId,
            documentType,
            filename,
          });
        } catch (redisError) {
          logger.error("Failed to store metadata in Redis", {
            userId,
            documentType,
            filename,
            error:
              redisError instanceof Error
                ? redisError.message
                : String(redisError),
          });
          // Don't fail the upload if Redis fails
        }
      }

      logger.info("File stored successfully", {
        userId,
        documentType,
        filename,
        size: file.size,
        hash,
      });

      return metadata;
    } catch (error) {
      logger.error("Error storing file", {
        userId,
        documentType,
        error: error instanceof Error ? error.message : String(error),
      });

      // Convert to appropriate AppError
      const { handleFileSystemError } = await import("../utils/errors");
      throw handleFileSystemError(error, "storing file");
    }
  }

  /**
   * Get file path
   */
  getFilePath(userId: string, documentType: string, filename: string): string {
    return path.join(this.getStoragePath(userId, documentType), filename);
  }

  /**
   * Check if file exists (checks Redis metadata and filesystem)
   */
  async fileExists(
    userId: string,
    documentType: string,
    filename: string
  ): Promise<boolean> {
    // Check Redis first if available
    if (redisClient.isReady) {
      try {
        const redisKey = REDIS_KEYS.FILE_METADATA(
          userId,
          documentType,
          filename
        );
        const exists = await redisClient.exists(redisKey);
        if (exists) {
          return true;
        }
      } catch (redisError) {
        logger.warn("Failed to check Redis for file existence", {
          userId,
          documentType,
          filename,
          error:
            redisError instanceof Error
              ? redisError.message
              : String(redisError),
        });
      }
    }

    // Fallback to filesystem check
    const filePath = this.getFilePath(userId, documentType, filename);
    return fs.existsSync(filePath);
  }

  /**
   * Delete file (from both filesystem and Redis)
   */
  async deleteFile(
    userId: string,
    documentType: string,
    filename: string
  ): Promise<void> {
    try {
      const filePath = this.getFilePath(userId, documentType, filename);

      // Delete from filesystem
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info("File deleted from filesystem", {
          userId,
          documentType,
          filename,
        });
      } else {
        logger.warn("File not found for deletion", {
          userId,
          documentType,
          filename,
        });
      }

      // Delete from Redis
      if (redisClient.isReady) {
        try {
          const redisKey = REDIS_KEYS.FILE_METADATA(
            userId,
            documentType,
            filename
          );
          const fileListKey = REDIS_KEYS.FILE_LIST(userId, documentType);

          await redisClient.del(redisKey);
          await redisClient.sRem(fileListKey, filename);

          logger.info("File metadata deleted from Redis", {
            userId,
            documentType,
            filename,
          });
        } catch (redisError) {
          logger.error("Failed to delete metadata from Redis", {
            userId,
            documentType,
            filename,
            error:
              redisError instanceof Error
                ? redisError.message
                : String(redisError),
          });
        }
      }
    } catch (error) {
      logger.error("Error deleting file", {
        userId,
        documentType,
        filename,
        error: error instanceof Error ? error.message : String(error),
      });

      // Convert to appropriate AppError
      const { handleFileSystemError } = await import("../utils/errors");
      throw handleFileSystemError(error, "deleting file");
    }
  }

  /**
   * List files for user and document type (uses Redis index with filesystem fallback)
   */
  async listFiles(userId: string, documentType: string): Promise<string[]> {
    // Try Redis first if available
    if (redisClient.isReady) {
      try {
        const fileListKey = REDIS_KEYS.FILE_LIST(userId, documentType);
        const files = await redisClient.sMembers(fileListKey);

        if (files.length > 0) {
          logger.debug("File list retrieved from Redis", {
            userId,
            documentType,
            count: files.length,
          });
          return files;
        }
      } catch (redisError) {
        logger.warn("Failed to retrieve file list from Redis", {
          userId,
          documentType,
          error:
            redisError instanceof Error
              ? redisError.message
              : String(redisError),
        });
      }
    }

    // Fallback to filesystem
    const storagePath = this.getStoragePath(userId, documentType);

    if (!fs.existsSync(storagePath)) {
      return [];
    }

    return fs.readdirSync(storagePath);
  }

  /**
   * Get file metadata from Redis
   */
  async getFileMetadata(
    userId: string,
    documentType: string,
    filename: string
  ): Promise<FileMetadata | null> {
    if (!redisClient.isReady) {
      return null;
    }

    try {
      const redisKey = REDIS_KEYS.FILE_METADATA(userId, documentType, filename);
      const data = await redisClient.hGetAll(redisKey);

      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return {
        filename: data.filename,
        originalName: data.originalName,
        path: data.path,
        size: parseInt(data.size, 10),
        mimetype: data.mimetype,
        hash: data.hash,
        url: data.url,
      };
    } catch (error) {
      logger.error("Failed to retrieve file metadata from Redis", {
        userId,
        documentType,
        filename,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

export const storageManager = new LocalStorageManager();
