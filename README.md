# Upload Service

A secure, high-performance file upload service designed for handling KYC (Know Your Customer) documents in a P2P platform. Features Redis-backed metadata storage with filesystem fallback for maximum reliability.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Error Handling](#error-handling)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security Considerations](#security-considerations)

## ✨ Features

- **Secure File Upload**: Validates file types, sizes, and metadata
- **Dual Storage System**: Redis metadata storage with filesystem persistence
- **Graceful Degradation**: Continues operation even if Redis is unavailable
- **Document Organization**: Files organized by `userId` and `documentType`
- **File Hash Verification**: SHA-256 hashing for file integrity
- **Comprehensive Logging**: Structured logging with Winston
- **Type Safety**: Full TypeScript implementation
- **Security Headers**: Helmet.js integration for HTTP security
- **CORS Support**: Configurable cross-origin resource sharing
- **High Test Coverage**: 80%+ test coverage with Jest

## 🏗️ Architecture

### Storage Strategy

The service uses a **hybrid storage approach**:

1. **Filesystem**: Primary storage for file content

   - Files organized in `{UPLOAD_DIR}/{userId}/{documentType}/{filename}` structure
   - Filenames are UUIDs with original extensions for security

2. **Redis**: Fast metadata access and indexing
   - File metadata stored as Redis hash: `file:{userId}:{documentType}:{filename}`
   - File lists stored as Redis sets: `files:{userId}:{documentType}`
   - Graceful fallback to filesystem when Redis is unavailable

### Request Flow

```
Client Request
    ↓
Express Middleware (Helmet, CORS, Body Parser)
    ↓
Multer Upload (validates file type/size)
    ↓
File Validation Middleware (checks metadata)
    ↓
Storage Manager
    ├─→ Store file to filesystem
    └─→ Cache metadata in Redis (optional)
    ↓
Response with file URL and metadata
```

### Key Components

- **`src/index.ts`**: Express application setup and server initialization
- **`src/routes/upload.ts`**: API endpoint handlers
- **`src/storage/localStorage.ts`**: File storage and metadata management
- **`src/middleware/fileValidation.ts`**: File validation logic
- **`src/config/redis.ts`**: Redis client configuration
- **`src/utils/logger.ts`**: Winston logger configuration

## 📦 Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **Package Manager**: pnpm (recommended), npm, or yarn
- **Redis**: v6+ (optional but recommended for production)

## 🚀 Installation

### 1. Clone and Install Dependencies

```bash
# Navigate to the upload-service directory
cd upload-service

# Install dependencies
pnpm install
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
```

### 3. Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
UPLOAD_SERVICE_PORT=5002

# Redis Configuration (optional in development)
REDIS_URL=redis://localhost:6379/2

# Storage Configuration
UPLOAD_DIR=./uploads

# Logging
LOG_LEVEL=info
```

#### Environment Variable Details

| Variable              | Required | Default                    | Description                                            |
| --------------------- | -------- | -------------------------- | ------------------------------------------------------ |
| `NODE_ENV`            | No       | `development`              | Environment mode (`development`, `production`, `test`) |
| `UPLOAD_SERVICE_PORT` | No       | `5002`                     | Port for the upload service                            |
| `REDIS_URL`           | No       | `redis://localhost:6379/2` | Redis connection URL                                   |
| `UPLOAD_DIR`          | No       | `./uploads`                | Directory for storing uploaded files                   |
| `LOG_LEVEL`           | No       | `info`                     | Logging level (`error`, `warn`, `info`, `debug`)       |

## 🎯 Configuration

### Accepted File Types

The service accepts the following file types for KYC documents:

- **Images**: JPEG (`.jpg`, `.jpeg`), PNG (`.png`)
- **Documents**: PDF (`.pdf`)

To modify accepted file types, edit `src/middleware/fileValidation.ts`:

```typescript
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
```

### File Size Limits

- **Maximum file size**: 10MB per file
- Configurable in `src/middleware/fileValidation.ts`

### Document Types

Valid document types for KYC:

- `ID_CARD`
- `PASSPORT`
- `DRIVERS_LICENSE`
- `PROOF_OF_ADDRESS`
- `SELFIE`

To add new document types, edit `src/middleware/fileValidation.ts`:

```typescript
const validDocumentTypes = [
  "ID_CARD",
  "PASSPORT",
  "DRIVERS_LICENSE",
  "PROOF_OF_ADDRESS",
  "SELFIE",
];
```

## 📡 API Documentation

### Base URL

```
http://localhost:5002
```

### Endpoints

#### 1. Health Check

Check service health and Redis connection status.

**Request:**

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "service": "upload-service",
  "timestamp": "2025-12-20T05:19:37.000Z",
  "redis": "connected"
}
```

---

#### 2. Upload File

Upload a new document file.

**Request:**

```http
POST /upload
Content-Type: multipart/form-data

Fields:
- file: <binary file data>
- userId: <string>
- documentType: <string> (ID_CARD, PASSPORT, etc.)
```

**Example with cURL:**

```bash
curl -X POST http://localhost:5002/upload \
  -F "file=@/path/to/document.pdf" \
  -F "userId=user123" \
  -F "documentType=PASSPORT"
```

**Example with JavaScript (fetch):**

```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("userId", "user123");
formData.append("documentType", "PASSPORT");

const response = await fetch("http://localhost:5002/upload", {
  method: "POST",
  body: formData,
});

const data = await response.json();
console.log(data);
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
    "originalName": "passport.pdf",
    "size": 1024567,
    "mimetype": "application/pdf",
    "hash": "5d41402abc4b2a76b9719d911017c592",
    "url": "/files/user123/PASSPORT/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
    "uploadedAt": "2025-12-20T05:19:37.000Z"
  }
}
```

**Error Responses:**

```json
// 400 Bad Request - No file uploaded
{
  "error": {
    "code": "NO_FILE_UPLOADED",
    "message": "No file was uploaded"
  }
}

// 400 Bad Request - File too large
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds 10MB limit",
    "maxSize": 10
  }
}

// 400 Bad Request - Invalid file type
{
  "error": {
    "code": "INVALID_FILE",
    "message": "Invalid file type. Only images (JPG, PNG) and PDF files are allowed."
  }
}

// 400 Bad Request - Missing userId
{
  "error": {
    "code": "MISSING_USER_ID",
    "message": "userId is required"
  }
}

// 400 Bad Request - Invalid documentType
{
  "error": {
    "code": "INVALID_DOCUMENT_TYPE",
    "message": "Invalid document type. Allowed: ID_CARD, PASSPORT, DRIVERS_LICENSE, PROOF_OF_ADDRESS, SELFIE"
  }
}

// 500 Internal Server Error
{
  "error": {
    "code": "UPLOAD_FAILED",
    "message": "Failed to upload file"
  }
}
```

---

#### 3. Retrieve File

Download or view an uploaded file.

**Request:**

```http
GET /files/:userId/:documentType/:filename
```

**Example:**

```bash
curl http://localhost:5002/files/user123/PASSPORT/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf
```

**Success Response:**

- **Status**: 200 OK
- **Content-Type**: Original file MIME type
- **Body**: Binary file data

**Error Responses:**

```json
// 404 Not Found
{
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File not found"
  }
}

// 500 Internal Server Error
{
  "error": {
    "code": "FILE_SERVE_ERROR",
    "message": "Failed to serve file"
  }
}
```

---

#### 4. List Files

List all files for a specific user and document type.

**Request:**

```http
GET /files/:userId/:documentType
```

**Example:**

```bash
curl http://localhost:5002/files/user123/PASSPORT
```

**Success Response (200 OK):**

```json
{
  "data": {
    "files": [
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
      "b2c3d4e5-f6a7-8901-bcde-f12345678901.pdf"
    ],
    "count": 2
  }
}
```

**Error Response:**

```json
// 500 Internal Server Error
{
  "error": {
    "code": "LIST_FAILED",
    "message": "Failed to list files"
  }
}
```

---

#### 5. Delete File

Delete an uploaded file (admin/internal use only).

**Request:**

```http
DELETE /files/:userId/:documentType/:filename
```

**Example:**

```bash
curl -X DELETE http://localhost:5002/files/user123/PASSPORT/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Error Response:**

```json
// 500 Internal Server Error
{
  "error": {
    "code": "DELETE_FAILED",
    "message": "Failed to delete file"
  }
}
```

---

## ⚠️ Error Handling

### Error Response Format

All error responses follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Error Codes

| Code                    | HTTP Status | Description                     |
| ----------------------- | ----------- | ------------------------------- |
| `NO_FILE_UPLOADED`      | 400         | No file provided in the request |
| `FILE_TOO_LARGE`        | 400         | File exceeds 10MB limit         |
| `INVALID_FILE`          | 400         | Invalid file type or extension  |
| `MISSING_USER_ID`       | 400         | userId parameter missing        |
| `MISSING_DOCUMENT_TYPE` | 400         | documentType parameter missing  |
| `INVALID_DOCUMENT_TYPE` | 400         | Invalid documentType value      |
| `FILE_NOT_FOUND`        | 404         | Requested file does not exist   |
| `UPLOAD_FAILED`         | 500         | File upload operation failed    |
| `FILE_SERVE_ERROR`      | 500         | Error serving file              |
| `DELETE_FAILED`         | 500         | File deletion operation failed  |
| `LIST_FAILED`           | 500         | Error listing files             |
| `INTERNAL_SERVER_ERROR` | 500         | Unhandled server error          |

### Logging

All errors are logged with structured metadata using Winston:

```typescript
logger.error("File upload failed", {
  error: error.message,
  userId: "user123",
  documentType: "PASSPORT",
});
```

## 💻 Development

### Running Locally

```bash
# Development mode with hot reload
pnpm dev

# The service will start on http://localhost:5002
```

### Project Structure

```
upload-service/
├── src/
│   ├── __tests__/           # Integration tests
│   │   └── index.test.ts
│   ├── config/              # Configuration files
│   │   ├── redis.ts         # Redis client setup
│   │   └── __tests__/
│   ├── middleware/          # Express middleware
│   │   ├── fileValidation.ts
│   │   └── __tests__/
│   ├── routes/              # API routes
│   │   ├── upload.ts
│   │   └── __tests__/
│   ├── storage/             # Storage management
│   │   ├── localStorage.ts
│   │   └── __tests__/
│   ├── utils/               # Utilities
│   │   └── logger.ts
│   └── index.ts             # Application entry point
├── uploads/                 # File storage directory
├── .env                     # Environment variables
├── .env.example             # Example environment file
├── package.json
├── tsconfig.json
└── jest.config.js
```

### Code Style

The project uses ESLint with TypeScript for code quality:

```bash
# Run linter
pnpm lint

# Auto-fix linting issues
pnpm lint:fix
```

### Building for Production

```bash
# Compile TypeScript to JavaScript
pnpm build

# Output will be in dist/ directory
```

## 🧪 Testing

### Test Coverage

The project maintains **80%+ test coverage** across all modules.

### Running Tests

```bash
# Run all tests with coverage
pnpm test

# Watch mode for development
pnpm test:watch
```

### Test Structure

Tests are colocated with source files in `__tests__/` directories:

- **Unit Tests**: Individual components (middleware, storage, config)
- **Integration Tests**: API routes and full application flow

### Example Test

```typescript
describe("POST /upload", () => {
  it("should successfully upload a file", async () => {
    const response = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("test"), "test.pdf")
      .field("userId", "test-user")
      .field("documentType", "PASSPORT");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("filename");
  });
});
```

## 🚢 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production` in environment
- [ ] Configure Redis connection (`REDIS_URL`)
- [ ] Set appropriate `UPLOAD_DIR` with sufficient disk space
- [ ] Configure log level (`LOG_LEVEL=warn` or `LOG_LEVEL=error`)
- [ ] Ensure upload directory has correct permissions
- [ ] Set up Redis persistence (RDB/AOF)
- [ ] Configure reverse proxy (nginx, etc.)
- [ ] Set up SSL/TLS certificates
- [ ] Configure CORS allowed origins
- [ ] Set up monitoring and alerting

### Running in Production

```bash
# Build the application
pnpm build

# Start the production server
pnpm start
```

### Docker Deployment (Example)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY uploads ./uploads

ENV NODE_ENV=production
ENV UPLOAD_SERVICE_PORT=5002

EXPOSE 5002

CMD ["node", "dist/index.js"]
```

### Environment-Specific Configuration

| Environment | NODE_ENV      | Redis Required    | Log Level         |
| ----------- | ------------- | ----------------- | ----------------- |
| Development | `development` | No (optional)     | `debug` or `info` |
| Staging     | `production`  | Yes (recommended) | `info`            |
| Production  | `production`  | Yes (required)    | `warn` or `error` |

## 🔒 Security Considerations

### Implemented Security Measures

1. **File Type Validation**

   - MIME type checking
   - File extension validation
   - Double validation (fileFilter + middleware)

2. **File Size Limits**

   - 10MB maximum file size
   - Configurable limits

3. **Secure Filenames**

   - UUID-based filenames prevent directory traversal
   - Original filenames not used in storage paths

4. **HTTP Security Headers**

   - Helmet.js for security headers
   - CORS configuration

5. **File Integrity**

   - SHA-256 hash calculation for uploaded files
   - Verification support

6. **Input Validation**

   - Strict validation of userId and documentType
   - Sanitization of user inputs

7. **Error Handling**
   - No sensitive information in error messages (production)
   - Structured error logging

### Additional Recommendations

1. **Authentication**: Implement authentication middleware to verify user identity
2. **Authorization**: Add authorization checks to ensure users can only access their own files
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **File Scanning**: Integrate antivirus/malware scanning for uploaded files
5. **Audit Logging**: Log all file operations for compliance
6. **Encryption**: Encrypt files at rest for sensitive documents
7. **Service Token**: Implement service-to-service authentication for internal API access

### Example: Adding Authentication

```typescript
// middleware/auth.ts
export const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }

  // Verify token and attach user to request
  try {
    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      }
    });
  }
};

// In routes/upload.ts
router.post('/upload', requireAuth, upload.single('file'), ...);
```

## 📝 License

ISC

## 🤝 Contributing

1. Follow the existing code style and conventions
2. Write tests for new features
3. Ensure all tests pass before submitting
4. Update documentation for API changes
5. Maintain test coverage above 80%

---

**For questions or issues, please contact the development team.**
