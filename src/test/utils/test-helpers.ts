import type { Context } from 'hono';

import { vi } from 'vitest';

import type { LoggerService } from '@/services/logger.service';
import type { TaskService } from '@/services/task.service';

/**
 * Creates a mock TaskService with all methods mocked
 */
export function createMockTaskService(): TaskService {
  return {
    getAllTasks: vi.fn(),
    getTaskById: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  } as unknown as TaskService;
}

/**
 * Creates a mock LoggerService with all methods mocked
 */
export function createMockLogger(): LoggerService {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  } as unknown as LoggerService;
}

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
 * Sample task data for testing
 */
export const sampleTasks = {
  task1: {
    id: 1,
    name: 'Sample Task 1',
    done: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  task2: {
    id: 2,
    name: 'Sample Task 2',
    done: true,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  },
  newTask: {
    name: 'New Task',
    done: false,
  },
  updateData: {
    name: 'Updated Task',
  },
};

/**
 * Utility to reset all mocks before each test
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}
