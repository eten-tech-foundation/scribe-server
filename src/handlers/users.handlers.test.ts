import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { logger } from '@/lib/logger';
import { resetAllMocks, sampleUsers } from '@/test/utils/test-helpers';

import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserByEmail,
  getUserById,
  toggleUserStatus,
  updateUser,
} from './users.handlers';

// Mock the database module
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the logger module
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
    it('should return all users', async () => {
      const mockUsers = [
        mockUser,
        { ...mockUser, id: 'user2-id', email: 'user2@example.com', username: 'user2' },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockUsers),
      });

      const result = await getAllUsers();

      expect(db.select).toHaveBeenCalledOnce();
      expect(logger.debug).toHaveBeenCalledWith('Fetching all users');
      expect(result).toEqual(mockUsers);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const result = await getUserById(mockUser.id);

      expect(db.select).toHaveBeenCalledOnce();
      expect(logger.debug).toHaveBeenCalledWith(`Fetching user with id: ${mockUser.id}`);
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await getUserById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const result = await getUserByEmail(mockUser.email);

      expect(db.select).toHaveBeenCalledOnce();
      expect(logger.debug).toHaveBeenCalledWith(`Fetching user with email: ${mockUser.email}`);
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await getUserByEmail('noone@example.com');

      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create and return a new user', async () => {
      const createdUser = {
        id: 'uuid-123',
        ...mockUserInput,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdUser]),
        }),
      });

      const result = await createUser(mockUserInput);

      expect(logger.debug).toHaveBeenCalledWith('Creating new user', {
        username: mockUserInput.username,
        email: mockUserInput.email,
      });
      expect(result).toEqual(createdUser);
    });
  });

  describe('updateUser', () => {
    it('should update and return the user when it exists', async () => {
      const updatedUser = { ...mockUser, ...updateData };

      // Mock getUserById to return existing user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock update operation
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedUser]),
          }),
        }),
      });

      const result = await updateUser(mockUser.id, updateData);

      expect(logger.debug).toHaveBeenCalledWith(
        `Updating user with id: ${mockUser.id}`,
        updateData
      );
      expect(result).toEqual(updatedUser);
    });

    it('should return null when user does not exist', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await updateUser('nonexistent-id', updateData);

      expect(logger.warn).toHaveBeenCalledWith('User with id nonexistent-id not found for update');
      expect(result).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('should delete the user and return true when it exists', async () => {
      // Mock getUserById to return existing user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock delete operation
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({ count: 1 }),
      });

      const result = await deleteUser(mockUser.id);

      expect(logger.debug).toHaveBeenCalledWith(`Deleting user with id: ${mockUser.id}`);
      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await deleteUser('nonexistent-id');

      expect(logger.warn).toHaveBeenCalledWith(
        'User with id nonexistent-id not found for deletion'
      );
      expect(result).toBe(false);
    });

    it('should return false when delete operation fails', async () => {
      // Mock getUserById to return existing user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock delete operation to return 0 count
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({ count: 0 }),
      });

      const result = await deleteUser(mockUser.id);

      expect(result).toBe(false);
    });
  });

  describe('toggleUserStatus', () => {
    it('should toggle user status and return updated user', async () => {
      const toggledUser = { ...mockUser, isActive: !mockUser.isActive };

      // Mock getUserById to return existing user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock update operation
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([toggledUser]),
          }),
        }),
      });

      const result = await toggleUserStatus(mockUser.id);

      expect(logger.debug).toHaveBeenCalledWith(`Toggling user status for id: ${mockUser.id}`);
      expect(result).toEqual(toggledUser);
    });

    it('should return null when user does not exist', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await toggleUserStatus('nonexistent-id');

      expect(logger.warn).toHaveBeenCalledWith(
        'User with id nonexistent-id not found for status toggle'
      );
      expect(result).toBeNull();
    });
  });
});
