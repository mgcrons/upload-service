# Upload Service - API Reference

Quick reference guide for the Upload Service API endpoints.

## Base URL

```
Development: http://localhost:5002
Production: https://your-domain.com/upload-service
```

## Authentication

> **Note**: Currently, the service does not implement authentication. It is recommended to add authentication middleware before deploying to production.

## Endpoints Summary

| Method | Endpoint                                 | Description     | Auth Required |
| ------ | ---------------------------------------- | --------------- | ------------- |
| GET    | `/health`                                | Health check    | No            |
| POST   | `/upload`                                | Upload a file   | No\*          |
| GET    | `/files/:userId/:documentType/:filename` | Retrieve a file | No\*          |
| GET    | `/files/:userId/:documentType`           | List files      | No\*          |
| DELETE | `/files/:userId/:documentType/:filename` | Delete a file   | No\*          |

\*Authentication should be added in production

---

## 1. Health Check

Check service status and dependencies.

### Request

```http
GET /health
```

### Response

```json
{
  "status": "healthy",
  "service": "upload-service",
  "timestamp": "2025-12-20T05:19:37.000Z",
  "redis": "connected" // or "disconnected"
}
```

### cURL Example

```bash
curl http://localhost:5002/health
```

---

## 2. Upload File

Upload a new document file.

### Request

```http
POST /upload
Content-Type: multipart/form-data
```

### Parameters

| Field          | Type   | Required | Description                              |
| -------------- | ------ | -------- | ---------------------------------------- |
| `file`         | File   | Yes      | The file to upload (max 10MB)            |
| `userId`       | String | Yes      | User identifier                          |
| `documentType` | String | Yes      | Document type (see allowed values below) |

#### Allowed Document Types

- `ID_CARD`
- `PASSPORT`
- `DRIVERS_LICENSE`
- `PROOF_OF_ADDRESS`
- `SELFIE`

#### Allowed File Types

- **Images**: `.jpg`, `.jpeg`, `.png`
- **Documents**: `.pdf`

### Success Response (200 OK)

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

### Error Responses

#### 400 Bad Request - No File

```json
{
  "error": {
    "code": "NO_FILE_UPLOADED",
    "message": "No file was uploaded"
  }
}
```

#### 400 Bad Request - File Too Large

```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds 10MB limit",
    "maxSize": 10
  }
}
```

#### 400 Bad Request - Invalid File Type

```json
{
  "error": {
    "code": "INVALID_FILE",
    "message": "Invalid file type. Only images (JPG, PNG) and PDF files are allowed."
  }
}
```

#### 400 Bad Request - Missing Parameters

```json
{
  "error": {
    "code": "MISSING_USER_ID",
    "message": "userId is required"
  }
}
```

```json
{
  "error": {
    "code": "MISSING_DOCUMENT_TYPE",
    "message": "documentType is required"
  }
}
```

#### 400 Bad Request - Invalid Document Type

```json
{
  "error": {
    "code": "INVALID_DOCUMENT_TYPE",
    "message": "Invalid document type. Allowed: ID_CARD, PASSPORT, DRIVERS_LICENSE, PROOF_OF_ADDRESS, SELFIE"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "UPLOAD_FAILED",
    "message": "Failed to upload file"
  }
}
```

### Examples

#### cURL

```bash
curl -X POST http://localhost:5002/upload \
  -F "file=@/path/to/passport.pdf" \
  -F "userId=user123" \
  -F "documentType=PASSPORT"
```

#### JavaScript (Fetch)

```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("userId", "user123");
formData.append("documentType", "PASSPORT");

const response = await fetch("http://localhost:5002/upload", {
  method: "POST",
  body: formData,
});

const result = await response.json();
console.log(result);
```

#### JavaScript (Axios)

```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("userId", "user123");
formData.append("documentType", "PASSPORT");

const response = await axios.post("http://localhost:5002/upload", formData, {
  headers: {
    "Content-Type": "multipart/form-data",
  },
});

console.log(response.data);
```

#### Python (Requests)

```python
import requests

url = 'http://localhost:5002/upload'
files = {'file': open('/path/to/passport.pdf', 'rb')}
data = {
    'userId': 'user123',
    'documentType': 'PASSPORT'
}

response = requests.post(url, files=files, data=data)
print(response.json())
```

---

## 3. Retrieve File

Download or view an uploaded file.

### Request

```http
GET /files/:userId/:documentType/:filename
```

### URL Parameters

| Parameter      | Type   | Required | Description            |
| -------------- | ------ | -------- | ---------------------- |
| `userId`       | String | Yes      | User identifier        |
| `documentType` | String | Yes      | Document type          |
| `filename`     | String | Yes      | File name (UUID-based) |

### Success Response (200 OK)

- **Content-Type**: Original file MIME type (e.g., `application/pdf`, `image/jpeg`)
- **Body**: Binary file data

### Error Responses

#### 404 Not Found

```json
{
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File not found"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "FILE_SERVE_ERROR",
    "message": "Failed to serve file"
  }
}
```

### Examples

#### cURL

```bash
# Download file
curl http://localhost:5002/files/user123/PASSPORT/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf \
  -o downloaded-passport.pdf

# View in browser
open http://localhost:5002/files/user123/PASSPORT/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf
```

#### HTML (Image)

```html
<img
  src="http://localhost:5002/files/user123/SELFIE/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
  alt="User selfie"
/>
```

#### HTML (PDF Embed)

```html
<iframe
  src="http://localhost:5002/files/user123/PASSPORT/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf"
  width="100%"
  height="600px"
>
</iframe>
```

#### JavaScript (Download)

```javascript
const url =
  "http://localhost:5002/files/user123/PASSPORT/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf";

// Download and trigger browser download
fetch(url)
  .then((res) => res.blob())
  .then((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "passport.pdf";
    a.click();
  });
```

---

## 4. List Files

List all files for a specific user and document type.

### Request

```http
GET /files/:userId/:documentType
```

### URL Parameters

| Parameter      | Type   | Required | Description     |
| -------------- | ------ | -------- | --------------- |
| `userId`       | String | Yes      | User identifier |
| `documentType` | String | Yes      | Document type   |

### Success Response (200 OK)

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

### Error Response

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "LIST_FAILED",
    "message": "Failed to list files"
  }
}
```

### Examples

#### cURL

```bash
curl http://localhost:5002/files/user123/PASSPORT
```

#### JavaScript (Fetch)

```javascript
const response = await fetch("http://localhost:5002/files/user123/PASSPORT");
const data = await response.json();

console.log(`Found ${data.data.count} files:`, data.data.files);
```

#### JavaScript (Display Files)

```javascript
const response = await fetch("http://localhost:5002/files/user123/PASSPORT");
const { data } = await response.json();

// Generate URLs for each file
const fileUrls = data.files.map(
  (filename) => `http://localhost:5002/files/user123/PASSPORT/${filename}`
);

console.log("File URLs:", fileUrls);
```

---

## 5. Delete File

Delete an uploaded file. **Note**: This endpoint should be restricted to admin/internal use only in production.

### Request

```http
DELETE /files/:userId/:documentType/:filename
```

### URL Parameters

| Parameter      | Type   | Required | Description            |
| -------------- | ------ | -------- | ---------------------- |
| `userId`       | String | Yes      | User identifier        |
| `documentType` | String | Yes      | Document type          |
| `filename`     | String | Yes      | File name (UUID-based) |

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Error Response

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "DELETE_FAILED",
    "message": "Failed to delete file"
  }
}
```

### Examples

#### cURL

```bash
curl -X DELETE http://localhost:5002/files/user123/PASSPORT/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf
```

#### JavaScript (Fetch)

```javascript
const response = await fetch(
  "http://localhost:5002/files/user123/PASSPORT/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
  { method: "DELETE" }
);

const result = await response.json();
console.log(result.message); // "File deleted successfully"
```

---

## Error Codes Reference

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

## Rate Limiting

> **Note**: Rate limiting is not currently implemented. It is recommended to add rate limiting middleware before deploying to production.

Recommended limits:

- Upload: 10 requests per minute per IP
- List/Retrieve: 60 requests per minute per IP
- Delete: 5 requests per minute per IP

## CORS Configuration

The service currently accepts requests from all origins. In production, configure CORS to allow only trusted origins:

```typescript
app.use(
  cors({
    origin: ["https://your-frontend.com", "https://admin.your-domain.com"],
    credentials: true,
  })
);
```

## Testing the API

### Postman Collection

You can import the following Postman collection to test the API:

```json
{
  "info": {
    "name": "Upload Service API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/health"
      }
    },
    {
      "name": "Upload File",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/upload",
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": ""
            },
            {
              "key": "userId",
              "value": "test-user",
              "type": "text"
            },
            {
              "key": "documentType",
              "value": "PASSPORT",
              "type": "text"
            }
          ]
        }
      }
    },
    {
      "name": "List Files",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/files/test-user/PASSPORT"
      }
    },
    {
      "name": "Get File",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/files/test-user/PASSPORT/{{filename}}"
      }
    },
    {
      "name": "Delete File",
      "request": {
        "method": "DELETE",
        "url": "{{baseUrl}}/files/test-user/PASSPORT/{{filename}}"
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:5002"
    },
    {
      "key": "filename",
      "value": ""
    }
  ]
}
```

### Environment Variables for Postman

```json
{
  "baseUrl": "http://localhost:5002",
  "userId": "test-user",
  "documentType": "PASSPORT"
}
```

---

## Support

For API issues or questions, please check:

1. Service logs for detailed error information
2. Health endpoint to verify service status
3. Redis connection if metadata operations are failing
4. File system permissions for upload directory

---

**Last Updated**: 2025-12-20
