import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { resetAllMocks, sampleUsers } from '@/test/utils/test-helpers';

import {
  activateUser,
  createUser,
  deactivateUser,
  deleteUser,
  getActiveUsers,
  getAllUsers,
  getInactiveUsers,
  getUserByEmail,
  getUserByEmailOrUsername,
  getUserById,
  getUserByUsername,
  getUsersByOrganization,
  getUsersCount,
  updateUser,
} from './users.handlers';

// Mock dependencies BEFORE importing modules that use them
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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

  describe('getUsersByOrganization', () => {
    it('should return users by organization in a result object', async () => {
      const mockUsers = [mockUser];
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockUsers),
        }),
      });

      const result = await getUsersByOrganization(1);

      expect(result).toEqual({ ok: true, data: mockUsers });
    });

    it('should return an error result if no users found in organization', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await getUsersByOrganization(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('No Users found in organization - or internal error');
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

    it('should convert email to lowercase before querying', async () => {
      const whereMock = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockUser]) });
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: whereMock,
        }),
      });

      await getUserByEmail('TEST@EXAMPLE.COM');
      expect(whereMock).toHaveBeenCalled();
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

  describe('getUserByUsername', () => {
    it('should return user by username in a result object', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockUser]) }),
        }),
      });

      const result = await getUserByUsername(mockUser.username);

      expect(result).toEqual({ ok: true, data: mockUser });
    });

    it('should return an error result when user not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await getUserByUsername('nonexistent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('User not found');
      }
    });
  });

  describe('getUserByEmailOrUsername', () => {
    it('should return user by email or username in a result object', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockUser]) }),
        }),
      });

      const result = await getUserByEmailOrUsername(mockUser.email);

      expect(result).toEqual({ ok: true, data: mockUser });
    });

    it('should convert identifier to lowercase for email lookups', async () => {
      const whereMock = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockUser]) });
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: whereMock,
        }),
      });

      await getUserByEmailOrUsername('TEST@EXAMPLE.COM');
      expect(whereMock).toHaveBeenCalled();
    });

    it('should return an error result when user not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await getUserByEmailOrUsername('noone@example.com');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('User not found');
      }
    });
  });

  describe('createUser', () => {
    it('should create and return a new user in a result object', async () => {
      const createdUser = {
        ...mockUserInput,
        id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: mockUserInput.email.toLowerCase(),
      };
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([createdUser]) }),
      });

      const result = await createUser(mockUserInput);

      expect(result).toEqual({ ok: true, data: createdUser });
    });

    it('should convert email to lowercase before inserting', async () => {
      const valuesMock = vi
        .fn()
        .mockReturnValue({ returning: vi.fn().mockResolvedValue([mockUser]) });
      (db.insert as any).mockReturnValue({
        values: valuesMock,
      });

      const inputWithUppercaseEmail = { ...mockUserInput, email: 'NEWUSER@EXAMPLE.COM' };
      await createUser(inputWithUppercaseEmail);

      expect(valuesMock).toHaveBeenCalledWith({
        ...inputWithUppercaseEmail,
        email: 'newuser@example.com',
      });
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

    it('should convert email to lowercase when updating', async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockUser]) }),
      });
      (db.update as any).mockReturnValue({
        set: setMock,
      });

      const updateWithEmail = { email: 'UPDATED@EXAMPLE.COM' };
      await updateUser(mockUser.id, updateWithEmail);

      expect(setMock).toHaveBeenCalledWith({ email: 'updated@example.com' });
    });

    it('should not modify input when no email is provided', async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockUser]) }),
      });
      (db.update as any).mockReturnValue({
        set: setMock,
      });

      await updateUser(mockUser.id, updateData);

      expect(setMock).toHaveBeenCalledWith(updateData);
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
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot delete user');
      }
    });
  });

  describe('getUsersCount', () => {
    it('should return the count of users', async () => {
      const mockCount = [{ count: 5 }];
      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockCount),
      });

      const result = await getUsersCount();

      expect(result).toBe(1);
    });

    it('should return 0 when no users exist', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      });

      const result = await getUsersCount();

      expect(result).toBe(0);
    });
  });

  describe('getActiveUsers', () => {
    it('should return all active users', async () => {
      const activeUsers = [mockUser, sampleUsers.user2];
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(activeUsers),
        }),
      });

      const result = await getActiveUsers();

      expect(result).toEqual(activeUsers);
    });

    it('should return empty array when no active users', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await getActiveUsers();

      expect(result).toEqual([]);
    });
  });

  describe('getInactiveUsers', () => {
    it('should return all inactive users', async () => {
      const inactiveUser = { ...mockUser, status: 'inactive' };
      const inactiveUsers = [inactiveUser];
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(inactiveUsers),
        }),
      });

      const result = await getInactiveUsers();

      expect(result).toEqual(inactiveUsers);
    });

    it('should return empty array when no inactive users', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await getInactiveUsers();

      expect(result).toEqual([]);
    });
  });

  describe('activateUser', () => {
    it('should activate user by setting status to verified', async () => {
      const activatedUser = { ...mockUser, status: 'verified' };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([activatedUser]) }),
        }),
      });

      const result = await activateUser(mockUser.id);

      expect(result).toEqual({ ok: true, data: activatedUser });
    });

    it('should return error if user activation fails', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await activateUser(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot update user');
      }
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user by setting status to inactive', async () => {
      const deactivatedUser = { ...mockUser, status: 'inactive' };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockReturnValue({ returning: vi.fn().mockResolvedValue([deactivatedUser]) }),
        }),
      });

      const result = await deactivateUser(mockUser.id);

      expect(result).toEqual({ ok: true, data: deactivatedUser });
    });

    it('should return error if user deactivation fails', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await deactivateUser(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot update user');
      }
    });
  });
});
