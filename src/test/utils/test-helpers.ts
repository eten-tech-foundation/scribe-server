import type { Context } from 'hono';

import { vi } from 'vitest';

/**
 * Creates a mock Hono Context with commonly used methods
 */
export function createMockContext(overrides: Partial<Context> = {}): Context {
  const mockContext = {
    json: vi.fn((data, status?) => ({ data, status }) as any),
    body: vi.fn((data, status?) => ({ data, status }) as any),
    text: vi.fn((text, status?) => ({ text, status }) as any),
    req: {
      json: vi.fn(),
      param: vi.fn(),
      query: vi.fn(),
      header: vi.fn(),
    },
    res: {},
    env: {},
    var: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    ...overrides,
  } as unknown as Context;

  return mockContext;
}

/**
 * Sample user data for testing
 */
export const sampleUsers = {
  user1: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: '456e7890-e89b-12d3-a456-426614174001',
    createdBy: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    isActive: true,
  },
  newUser: {
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: '456e7890-e89b-12d3-a456-426614174001',
    createdBy: null,
  },
  updateUser: {
    firstName: 'Jane',
    lastName: 'Smith',
  },
};

/**
 * Utility to reset all mocks before each test
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}
