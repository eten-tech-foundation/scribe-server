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

/**
 * Creates mock database query builder chains
 */
export function createMockQueryBuilder() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    rightJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
  };
}

/**
 * Mock data generators for consistent testing
 */
export const mockDataGenerators = {
  // User generators
  createUser: (overrides: Partial<any> = {}) => ({
    ...sampleUsers.user1,
    ...overrides,
  }),

  createUserArray: (count: number = 1) => [sampleUsers.user1].slice(0, count),

  // Project generators
  createProject: (overrides: Partial<any> = {}) => ({
    ...sampleProjects.project1,
    ...overrides,
  }),

  createActiveProjects: () => [sampleProjects.project1],

  createProjectsByUser: (userId: number) => [{ ...sampleProjects.project1, createdBy: userId }],

  // Language generators
  createLanguage: (overrides: Partial<any> = {}) => ({
    ...sampleLanguages.english,
    ...overrides,
  }),

  createLanguageArray: (count: number = 2) =>
    [sampleLanguages.english, sampleLanguages.spanish].slice(0, count),

  // Generic generators
  createEmptyResult: () => [],

  createCountResult: (count: number = 5) => [{ count }],

  createIdResult: (id: number) => [{ id }],
};

/**
 * Mock database response helpers
 */
export const mockDbResponses = {
  // Success responses
  successfulSelect: (data: any) => ({ from: vi.fn().mockResolvedValue(data) }),

  successfulSelectWithWhere: (data: any) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(data),
    }),
  }),

  successfulSelectWithJoin: (data: any) => ({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(data),
      }),
    }),
  }),

  successfulSelectById: (data: any) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(data),
      }),
    }),
  }),

  successfulInsert: (data: any) => ({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([data]),
    }),
  }),

  successfulUpdate: (data: any) => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([data]),
      }),
    }),
  }),

  successfulDelete: (id: number) => ({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id }]),
    }),
  }),

  // Failure responses
  failedSelect: () => ({ from: vi.fn().mockResolvedValue(undefined) }),

  failedSelectWithWhere: () => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }),

  failedSelectById: () => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),

  failedInsert: () => ({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  }),

  failedUpdate: () => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),

  failedDelete: () => ({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  }),
};

/**
 * Common test data combinations
 */
export const testDataSets = {
  users: {
    all: [sampleUsers.user1, sampleUsers.user2],
    active: [sampleUsers.user1],
    inactive: [sampleUsers.user2],
    byOrganization: (orgId: number) => [
      { ...sampleUsers.user1, organization: orgId },
      { ...sampleUsers.user2, organization: orgId },
    ],
  },

  projects: {
    all: [sampleProjects.project1],
    active: [sampleProjects.project1],
    byUser: (userId: number) => [{ ...sampleProjects.project1, createdBy: userId }],
    byOrganization: (orgId: number) => [{ ...sampleProjects.project1, organization: orgId }],
  },

  languages: {
    all: [sampleLanguages.english, sampleLanguages.spanish],
    european: [sampleLanguages.english, sampleLanguages.spanish],
  },
};

/**
 * Language mapping utilities for testing
 */
export const languageMappings = {
  // Map language codes to IDs for easier testing
  codeToId: {
    en: 1, // English
    fr: 2, // French
    es: 3, // Spanish
    de: 4, // German
    it: 5, // Italian
  },

  // Map IDs to language objects
  idToLanguage: {
    1: sampleLanguages.english,
    3: sampleLanguages.spanish,
  },

  // Get language IDs from codes
  getIdsFromCodes: (codes: string[]): number[] => {
    return codes
      .map((code) => languageMappings.codeToId[code as keyof typeof languageMappings.codeToId])
      .filter(Boolean);
  },

  // Get language codes from IDs
  getCodesFromIds: (ids: number[]): string[] => {
    return ids
      .map((id) => {
        const lang =
          languageMappings.idToLanguage[id as keyof typeof languageMappings.idToLanguage];
        return lang?.langCodeBcp47 || '';
      })
      .filter(Boolean);
  },
};
