/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/__tests__/**",
    "!src/**/*.test.ts",
    "!src/index.ts", // Entry point, tested via integration tests
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageDirectory: "coverage",
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  verbose: true,
  testTimeout: 10000,
};
