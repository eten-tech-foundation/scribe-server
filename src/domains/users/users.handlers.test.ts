import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleUsers, resetAllMocks } from '@/test/utils/test-helpers';
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserByEmail,
  getUserById,
  toggleUserStatus,
  updateUser,
} from './users.handlers';
import { db } from '@/db';

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

describe('User Handler Functions', () => {
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
      (db.select as any).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockUser]) }) }) });

      const result = await getUserById(mockUser.id);

      expect(result).toEqual({ ok: true, data: mockUser });
    });

    it('should return an error result when user not found', async () => {
      (db.select as any).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) });

      const result = await getUserById('nonexistent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('User not found');
      }
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email in a result object', async () => {
      (db.select as any).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockUser]) }) }) });

      const result = await getUserByEmail(mockUser.email);

      expect(result).toEqual({ ok: true, data: mockUser });
    });

    it('should return an error result when user not found', async () => {
      (db.select as any).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) });

      const result = await getUserByEmail('noone@example.com');

      expect(result.ok).toBe(false);
    });
  });

  describe('createUser', () => {
    it('should create and return a new user in a result object', async () => {
      const createdUser = { ...mockUserInput, id: 'new-id', createdAt: new Date(), updatedAt: new Date(), isActive: true };
      (db.insert as any).mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([createdUser]) }) });

      const result = await createUser(mockUserInput);

      expect(result).toEqual({ ok: true, data: createdUser });
    });

    it('should return an error result if creation fails', async () => {
      (db.insert as any).mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) });

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
      (db.update as any).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([updatedUser]) }) }) });

      const result = await updateUser(mockUser.id, updateData);

      expect(result).toEqual({ ok: true, data: updatedUser });
    });

    it('should return an error result when user to update is not found', async () => {
      (db.update as any).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }) });

      const result = await updateUser('nonexistent-id', updateData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot update user');
      }
    });
  });

  describe('deleteUser', () => {
    it('should delete the user and return a success result', async () => {
      (db.delete as any).mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: mockUser.id }]) }) });

      const result = await deleteUser(mockUser.id);

      expect(result).toEqual({ ok: true, data: true });
    });

    it('should return an error result when user to delete is not found', async () => {
      (db.delete as any).mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) });

      const result = await deleteUser('nonexistent-id');

      expect(result.ok).toBe(false);
    });
  });

  describe('toggleUserStatus', () => {
    it('should toggle user status and return updated user in a result object', async () => {
      const toggledUser = { ...mockUser, isActive: !mockUser.isActive };
      (db.update as any).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([toggledUser]) }) }) });

      const result = await toggleUserStatus(mockUser.id);

      expect(result).toEqual({ ok: true, data: toggledUser });
    });

    it('should return an error result when user to toggle is not found', async () => {
      (db.update as any).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }) });

      const result = await toggleUserStatus('nonexistent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot toggle user status');
      }
    });
  });
});
