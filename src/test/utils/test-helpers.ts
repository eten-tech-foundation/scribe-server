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
      valid: vi.fn(),
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
 * Sample data for testing
 */
export const sampleUsers = {
  user1: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 1,
    organization: 1,
    createdBy: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    status: 'verified' as const,
  },
  user2: {
    id: 2,
    username: 'testuser2',
    email: 'test2@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 1,
    organization: 1,
    createdBy: null,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    status: 'invited' as const,
  },
  newUser: {
    username: 'newuser',
    email: 'newuser@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 1,
    organization: 1,
    createdBy: null,
    status: 'invited' as const,
  },
  updateUser: {
    firstName: 'Jane',
    lastName: 'Smith',
  },
  updateUserWithEmail: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'updated@example.com',
  },
};

export const sampleLanguages = {
  english: {
    id: 1,
    description: 'English language',
    langName: 'English',
    langNameLocalized: 'English',
    langCodeBcp47: 'en',
    langCodeIso6393: 'eng',
    altLangNames: 'English',
    scriptDirection: 'ltr',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  spanish: {
    id: 3,
    description: 'Spanish language',
    langName: 'Spanish',
    langNameLocalized: 'Español',
    langCodeBcp47: 'es',
    langCodeIso6393: 'spa',
    altLangNames: 'Spanish',
    scriptDirection: 'ltr',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
};

export const sampleBibles = {
  kjv: {
    id: 1,
    name: 'King James Version',
    abbreviation: 'KJV',
    language: 1,
    description: 'English translation',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
};

export const sampleProjects = {
  project1: {
    id: 1,
    name: 'Test Project',
    description: 'A test project for translations',
    sourceLanguage: 1,
    targetLanguage: 3,
    isActive: true,
    createdBy: 1,
    organization: 1,
    assignedTo: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    metadata: { priority: 'high', category: 'marketing' },
  },
  newProject: {
    name: 'New Test Project',
    description: 'A newly created project',
    sourceLanguage: 4,
    targetLanguage: 2,
    isActive: true,
    createdBy: 1,
    organization: 1,
    assignedTo: null,
    metadata: { priority: 'high', category: 'product' },
  },
  updateProject: {
    name: 'Updated Project Name',
    description: 'Updated description',
    metadata: { priority: 'medium', category: 'updated' },
  },
  projectWithLanguageNames1: {
    id: 1,
    name: 'Test Project',
    description: 'A test project for translations',
    organization: 1,
    isActive: true,
    createdBy: 1,
    assignedTo: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    metadata: { priority: 'high', category: 'marketing' },
    sourceLanguageName: 'English',
    targetLanguageName: 'Spanish',
    sourceName: 'King James Version',
  },
};

/**
 * Utility to reset all mocks before each test
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}

/**
 * Helper to create result objects for testing
 */
export function createResult<T>(data: T, success: boolean = true) {
  return success
    ? { ok: true, data }
    : { ok: false, error: { message: typeof data === 'string' ? data : 'Error occurred' } };
}
