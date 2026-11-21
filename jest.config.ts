import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 15000,
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/entradas/**'],
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
  coverageReporters: ['text', 'text-summary', 'lcov'],
};

module.exports = config;
