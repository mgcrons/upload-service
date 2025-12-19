import fs from "fs";
import path from "path";

// Mock environment variables for testing
process.env.NODE_ENV = "test";
process.env.UPLOAD_DIR = path.join(__dirname, "../../test-uploads");
process.env.REDIS_URL = "redis://localhost:6379/15"; // Use different DB for tests
process.env.UPLOAD_SERVICE_PORT = "5999";

// Clean up test uploads directory before and after tests
const testUploadsDir = process.env.UPLOAD_DIR;

beforeAll(() => {
  if (fs.existsSync(testUploadsDir)) {
    fs.rmSync(testUploadsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testUploadsDir, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(testUploadsDir)) {
    fs.rmSync(testUploadsDir, { recursive: true, force: true });
  }
});

// Suppress console logs during tests unless there's an error
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging failed tests
};
