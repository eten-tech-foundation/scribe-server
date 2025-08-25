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
 * Sample user data for testing
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

/**
 * Sample language data for testing
 */
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
  french: {
    id: 2,
    description: 'French language',
    langName: 'French',
    langNameLocalized: 'Français',
    langCodeBcp47: 'fr',
    langCodeIso6393: 'fra',
    altLangNames: 'French',
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
  german: {
    id: 4,
    description: 'German language',
    langName: 'German',
    langNameLocalized: 'Deutsch',
    langCodeBcp47: 'de',
    langCodeIso6393: 'deu',
    altLangNames: 'German',
    scriptDirection: 'ltr',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  italian: {
    id: 5,
    description: 'Italian language',
    langName: 'Italian',
    langNameLocalized: 'Italiano',
    langCodeBcp47: 'it',
    langCodeIso6393: 'ita',
    altLangNames: 'Italian',
    scriptDirection: 'ltr',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
};

/**
 * Sample project data for testing
 */
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
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    metadata: { priority: 'high', category: 'marketing' },
  },
  project2: {
    id: 2,
    name: 'Second Project',
    description: 'Another test project',
    sourceLanguage: 1,
    targetLanguage: 4,
    isActive: true,
    createdBy: 2,
    organization: 1,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    metadata: { priority: 'medium', category: 'documentation' },
  },
  inactiveProject: {
    id: 3,
    name: 'Inactive Project',
    description: 'A deactivated project',
    sourceLanguage: 2,
    targetLanguage: 5,
    isActive: false,
    createdBy: 1,
    organization: 2,
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
    metadata: { priority: 'low', category: 'archive' },
  },
  newProject: {
    name: 'New Test Project',
    description: 'A newly created project',
    sourceLanguage: 4,
    targetLanguage: 2,
    isActive: true,
    createdBy: 1,
    organization: 1,
    metadata: { priority: 'high', category: 'product' },
  },
  updateProject: {
    name: 'Updated Project Name',
    description: 'Updated description',
    metadata: { priority: 'medium', category: 'updated' },
  },
};

/**
 * Sample error messages for testing
 */
export const sampleErrors = {
  // User errors
  userNotFound: 'User not found',
  userExists: 'A user with this email already exists.',
  unableToCreateUser: 'Unable to create user',
  cannotUpdateUser: 'Cannot update user',
  cannotDeleteUser: 'Cannot delete user',
  noUsersFound: 'No Users found - or internal error',
  noUsersInOrganization: 'No Users found in organization - or internal error',

  // Project errors
  projectNotFound: 'Project not found',
  unableToCreateProject: 'Unable to create project',
  cannotUpdateProject: 'Cannot update project',
  cannotDeleteProject: 'Cannot delete project',
  noProjectsFound: 'No Projects found - or internal error',
  noProjectsInOrganization: 'No Projects found in organization - or internal error',
  noProjectsForUser: 'No Projects found for user - or internal error',

  // Language errors
  languageNotFound: 'Language not found',
  unableToCreateLanguage: 'Unable to create language',
  cannotUpdateLanguage: 'Cannot update language',
  cannotDeleteLanguage: 'Cannot delete language',
  noLanguagesFound: 'No Languages found - or internal error',
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

  createUserArray: (count: number = 2) => [sampleUsers.user1, sampleUsers.user2].slice(0, count),

  // Project generators
  createProject: (overrides: Partial<any> = {}) => ({
    ...sampleProjects.project1,
    ...overrides,
  }),

  createProjectArray: (count: number = 2) =>
    [sampleProjects.project1, sampleProjects.project2].slice(0, count),

  createActiveProjects: () => [sampleProjects.project1, sampleProjects.project2],

  createInactiveProjects: () => [sampleProjects.inactiveProject],

  createProjectsByUser: (userId: number) => [
    { ...sampleProjects.project1, createdBy: userId },
    { ...sampleProjects.project2, createdBy: userId },
  ],

  // Language generators
  createLanguage: (overrides: Partial<any> = {}) => ({
    ...sampleLanguages.english,
    ...overrides,
  }),

  createLanguageArray: (count: number = 4) =>
    [
      sampleLanguages.english,
      sampleLanguages.french,
      sampleLanguages.spanish,
      sampleLanguages.german,
    ].slice(0, count),

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
    all: [sampleProjects.project1, sampleProjects.project2],
    active: [sampleProjects.project1, sampleProjects.project2],
    inactive: [sampleProjects.inactiveProject],
    byUser: (userId: number) => [
      { ...sampleProjects.project1, createdBy: userId },
      { ...sampleProjects.project2, createdBy: userId },
    ],
    byOrganization: (orgId: number) => [
      { ...sampleProjects.project1, organization: orgId },
      { ...sampleProjects.project2, organization: orgId },
    ],
  },

  languages: {
    all: [
      sampleLanguages.english,
      sampleLanguages.french,
      sampleLanguages.spanish,
      sampleLanguages.german,
    ],
    european: [
      sampleLanguages.english,
      sampleLanguages.french,
      sampleLanguages.spanish,
      sampleLanguages.german,
    ],
    romance: [sampleLanguages.french, sampleLanguages.spanish, sampleLanguages.italian],
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
    2: sampleLanguages.french,
    3: sampleLanguages.spanish,
    4: sampleLanguages.german,
    5: sampleLanguages.italian,
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
