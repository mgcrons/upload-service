/**
 * Custom error classes for better error handling and appropriate HTTP status codes
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class StorageError extends AppError {
  constructor(message: string) {
    super(message, 500, "STORAGE_ERROR");
  }
}

export class FileSystemError extends AppError {
  constructor(message: string, cause?: string) {
    const errorMessage = cause ? `${message}: ${cause}` : message;
    super(errorMessage, 500, "FILESYSTEM_ERROR");
  }
}

/**
 * Determine if an error is operational (expected) or a programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Convert Node.js filesystem errors to appropriate AppErrors
 */
export function handleFileSystemError(
  error: unknown,
  context: string
): AppError {
  if (error instanceof Error) {
    // Check for common Node.js error codes
    const nodeError = error as NodeJS.ErrnoException;

    switch (nodeError.code) {
      case "ENOENT":
        return new NotFoundError(`File or directory not found: ${context}`);
      case "EACCES":
      case "EPERM":
        return new FileSystemError(`Permission denied: ${context}`);
      case "ENOSPC":
        return new StorageError(`No space left on device: ${context}`);
      case "EXDEV":
        return new FileSystemError(`Cross-device operation failed: ${context}`);
      default:
        return new FileSystemError(context, error.message);
    }
  }

  // Unknown error type
  return new StorageError(`Unknown error during ${context}`);
}
