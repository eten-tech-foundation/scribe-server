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
  invitationUser: {
    username: 'inviteuser',
    email: 'invite@example.com',
    firstName: 'Invited',
    lastName: 'User',
    role: 1,
    organization: 1,
    createdBy: null,
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
 * Sample invitation result data for testing
 */
export const sampleInvitationResults = {
  successResult: {
    user: sampleUsers.user1,
    auth0_user_id: 'auth0|123456789',
    ticket_url: 'https://example.auth0.com/lo/reset?ticket=abc123xyz',
  },
  ticketResult: {
    ticket_url: 'https://example.auth0.com/lo/reset?ticket=def456uvw',
  },
};

/**
 * Sample error messages for testing
 */
export const sampleErrors = {
  userExists: 'A user with this email already exists.',
  auth0Error: 'Auth0 user creation failed',
  rollbackError:
    'User creation failed during Auth0 sync and was rolled back. Reason: Auth0 API error',
  ticketError: 'Failed to generate password change ticket.',
  invitationError: 'Failed to send invitation',
};

/**
 * Utility to reset all mocks before each test
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}

/**
 * Creates mock Auth0 user data
 */
export function createMockAuth0User(overrides: Partial<any> = {}) {
  return {
    user_id: 'auth0|123456789',
    email: 'test@example.com',
    name: 'John Doe',
    connection: 'Username-Password-Authentication',
    email_verified: false,
    ...overrides,
  };
}

/**
 * Creates mock password change ticket
 */
export function createMockTicket(overrides: Partial<any> = {}) {
  return {
    ticket: 'https://example.auth0.com/lo/reset?ticket=abc123xyz',
    ...overrides,
  };
}

/**
 * Helper to create result objects for testing
 */
export function createResult<T>(data: T, success: boolean = true) {
  return success
    ? { ok: true, data }
    : { ok: false, error: { message: typeof data === 'string' ? data : 'Error occurred' } };
}
