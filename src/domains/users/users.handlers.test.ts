import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { resetAllMocks, sampleUsers } from '@/test/utils/test-helpers';

import {
  createUser,
  createUserWithInvitation,
  deleteUser,
  getAllUsers,
  getUserByEmail,
  getUserById,
  sendInvitationEmailToExistingUser,
  toggleUserStatus,
  updateUser,
} from './users.handlers';
import {
  createUserWithInvitation as createUserWithInvitationService,
  sendInvitationToExistingUser as sendInvitationToExistingUserService,
} from './users.service';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('./users.service', () => ({
  createUserWithInvitation: vi.fn(),
  sendInvitationToExistingUser: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('user Handler Functions', () => {
  const mockUser = sampleUsers.user1;
  const mockUserInput = sampleUsers.newUser;
  const updateData = sampleUsers.updateUser;

  beforeEach(() => {
    resetAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return all users in a result object', async () => {
      const mockUsers = [mockUser];
      (db.select as any).mockReturnValue({ from: vi.fn().mockResolvedValue(mockUsers) });

      const result = await getAllUsers();

      expect(result).toEqual({ ok: true, data: mockUsers });
    });

    it('should return an error result if db call fails', async () => {
      (db.select as any).mockReturnValue({ from: vi.fn().mockResolvedValue(undefined) });

      const result = await getAllUsers();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('No Users found - or internal error');
      }
    });
  });

  describe('getUserById', () => {
    it('should return user by ID in a result object', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockUser]) }),
        }),
      });

      const result = await getUserById(mockUser.id);

      expect(result).toEqual({ ok: true, data: mockUser });
    });

    it('should return an error result when user not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await getUserById(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('User not found');
      }
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email in a result object', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockUser]) }),
        }),
      });

      const result = await getUserByEmail(mockUser.email);

      expect(result).toEqual({ ok: true, data: mockUser });
    });

    it('should return an error result when user not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await getUserByEmail('noone@example.com');

      expect(result.ok).toBe(false);
    });
  });

  describe('createUser', () => {
    it('should create and return a new user in a result object', async () => {
      const createdUser = {
        ...mockUserInput,
        id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([createdUser]) }),
      });

      const result = await createUser(mockUserInput);

      expect(result).toEqual({ ok: true, data: createdUser });
    });

    it('should return an error result if creation fails', async () => {
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      });

      const result = await createUser(mockUserInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Unable to create user');
      }
    });
  });

  describe('createUserWithInvitation', () => {
    it('should create user with invitation and return result', async () => {
      const mockResult = {
        user: mockUser,
        auth0_user_id: 'auth0|123456',
        ticket_url: 'https://example.com/ticket/abc123',
      };
      const expectedResult = { ok: true, data: mockResult };

      (createUserWithInvitationService as any).mockResolvedValue(expectedResult);

      const result = await createUserWithInvitation(mockUserInput);

      expect(result).toEqual(expectedResult);
      expect(createUserWithInvitationService).toHaveBeenCalledWith(mockUserInput);
    });

    it('should return error result when service fails', async () => {
      const errorResult = {
        ok: false,
        error: { message: 'A user with this email already exists.' },
      };
      (createUserWithInvitationService as any).mockResolvedValue(errorResult);

      const result = await createUserWithInvitation(mockUserInput);

      expect(result).toEqual(errorResult);
      expect(createUserWithInvitationService).toHaveBeenCalledWith(mockUserInput);
    });

    it('should handle Auth0 sync failures with rollback', async () => {
      const errorResult = {
        ok: false,
        error: {
          message:
            'User creation failed during Auth0 sync and was rolled back. Reason: Auth0 API error',
        },
      };
      (createUserWithInvitationService as any).mockResolvedValue(errorResult);

      const result = await createUserWithInvitation(mockUserInput);

      expect(result).toEqual(errorResult);
    });
  });

  describe('sendInvitationEmailToExistingUser', () => {
    it('should send invitation to existing user and return ticket URL', async () => {
      const expectedResult = {
        ok: true,
        data: { ticket_url: 'https://example.com/ticket/xyz789' },
      };
      (sendInvitationToExistingUserService as any).mockResolvedValue(expectedResult);

      const result = await sendInvitationEmailToExistingUser(
        'auth0|123456',
        'user@example.com',
        'John',
        'Doe'
      );

      expect(result).toEqual(expectedResult);
      expect(sendInvitationToExistingUserService).toHaveBeenCalledWith(
        'auth0|123456',
        'user@example.com',
        'John',
        'Doe'
      );
    });

    it('should send invitation without optional names', async () => {
      const expectedResult = {
        ok: true,
        data: { ticket_url: 'https://example.com/ticket/xyz789' },
      };
      (sendInvitationToExistingUserService as any).mockResolvedValue(expectedResult);

      const result = await sendInvitationEmailToExistingUser('auth0|123456', 'user@example.com');

      expect(result).toEqual(expectedResult);
      expect(sendInvitationToExistingUserService).toHaveBeenCalledWith(
        'auth0|123456',
        'user@example.com',
        undefined,
        undefined
      );
    });

    it('should return error result when service fails', async () => {
      const errorResult = {
        ok: false,
        error: { message: 'Failed to send invitation' },
      };
      (sendInvitationToExistingUserService as any).mockResolvedValue(errorResult);

      const result = await sendInvitationEmailToExistingUser('auth0|123456', 'user@example.com');

      expect(result).toEqual(errorResult);
    });

    it('should handle Auth0 ticket creation failures', async () => {
      const errorResult = {
        ok: false,
        error: { message: 'Failed to generate password change ticket.' },
      };
      (sendInvitationToExistingUserService as any).mockResolvedValue(errorResult);

      const result = await sendInvitationEmailToExistingUser('invalid-user-id', 'user@example.com');

      expect(result).toEqual(errorResult);
    });
  });

  describe('updateUser', () => {
    it('should update and return the user in a result object', async () => {
      const updatedUser = { ...mockUser, ...updateData };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([updatedUser]) }),
        }),
      });

      const result = await updateUser(mockUser.id, updateData);

      expect(result).toEqual({ ok: true, data: updatedUser });
    });

    it('should return an error result when user to update is not found', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await updateUser(999, updateData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot update user');
      }
    });
  });

  describe('deleteUser', () => {
    it('should delete the user and return a success result', async () => {
      (db.delete as any).mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: mockUser.id }]) }),
      });

      const result = await deleteUser(mockUser.id);

      expect(result).toEqual({ ok: true, data: true });
    });

    it('should return an error result when user to delete is not found', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      });

      const result = await deleteUser(999);

      expect(result.ok).toBe(false);
    });
  });

  describe('toggleUserStatus', () => {
    it('should toggle user status and return updated user in a result object', async () => {
      const toggledUser = { ...mockUser, isActive: !mockUser.isActive };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([toggledUser]) }),
        }),
      });

      const result = await toggleUserStatus(mockUser.id);

      expect(result).toEqual({ ok: true, data: toggledUser });
    });

    it('should return an error result when user to toggle is not found', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await toggleUserStatus(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot toggle user status');
      }
    });
  });
});
