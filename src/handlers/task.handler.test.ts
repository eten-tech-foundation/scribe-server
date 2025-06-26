import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tasks } from '@/db/schema';
import { sampleTasks } from '@/test/utils/test-helpers';

import { createTask, deleteTask, getAllTasks, getTaskById, updateTask } from './task.handler';

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

// Import the mocked modules
import { db } from '@/db';
import { logger } from '@/lib/logger';

describe('Task Handler Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllTasks', () => {
    it('should return all tasks', async () => {
      const mockTasks = [sampleTasks.task1, sampleTasks.task2];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockTasks),
      });

      const result = await getAllTasks();

      expect(db.select).toHaveBeenCalledOnce();
      expect(logger.debug).toHaveBeenCalledWith('Fetching all tasks');
      expect(result).toEqual(mockTasks);
    });
  });

  describe('getTaskById', () => {
    it('should return a task when found', async () => {
      const taskId = 1;
      const mockTask = sampleTasks.task1;

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTask]),
          }),
        }),
      });

      const result = await getTaskById(taskId);

      expect(db.select).toHaveBeenCalledOnce();
      expect(logger.debug).toHaveBeenCalledWith(`Fetching task with id: ${taskId}`);
      expect(result).toEqual(mockTask);
    });

    it('should return null when task not found', async () => {
      const taskId = 999;

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await getTaskById(taskId);

      expect(result).toBeNull();
    });
  });

  describe('createTask', () => {
    it('should create and return a new task', async () => {
      const newTaskInput = sampleTasks.newTask;
      const createdTask = { id: 1, ...newTaskInput, createdAt: new Date(), updatedAt: new Date() };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdTask]),
        }),
      });

      const result = await createTask(newTaskInput);

      expect(db.insert).toHaveBeenCalledWith(tasks);
      expect(logger.debug).toHaveBeenCalledWith('Creating new task', newTaskInput);
      expect(result).toEqual(createdTask);
    });
  });

  describe('updateTask', () => {
    it('should update and return the task when it exists', async () => {
      const taskId = 1;
      const updateInput = sampleTasks.updateData;
      const existingTask = sampleTasks.task1;
      const updatedTask = { ...existingTask, ...updateInput };

      // Mock getTaskById to return existing task
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingTask]),
          }),
        }),
      });

      // Mock update operation
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTask]),
          }),
        }),
      });

      const result = await updateTask(taskId, updateInput);

      expect(logger.debug).toHaveBeenCalledWith(`Updating task with id: ${taskId}`, updateInput);
      expect(result).toEqual(updatedTask);
    });

    it('should return null when task does not exist', async () => {
      const taskId = 999;
      const updateInput = sampleTasks.updateData;

      // Mock getTaskById to return null
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await updateTask(taskId, updateInput);

      expect(logger.warn).toHaveBeenCalledWith(`Task with id ${taskId} not found for update`);
      expect(result).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('should delete the task and return true when it exists', async () => {
      const taskId = 1;
      const existingTask = sampleTasks.task1;

      // Mock getTaskById to return existing task
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingTask]),
          }),
        }),
      });

      // Mock delete operation
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({ count: 1 }),
      });

      const result = await deleteTask(taskId);

      expect(db.delete).toHaveBeenCalledWith(tasks);
      expect(logger.debug).toHaveBeenCalledWith(`Deleting task with id: ${taskId}`);
      expect(result).toBe(true);
    });

    it('should return false when task does not exist', async () => {
      const taskId = 999;

      // Mock getTaskById to return null
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await deleteTask(taskId);

      expect(logger.warn).toHaveBeenCalledWith(`Task with id ${taskId} not found for deletion`);
      expect(result).toBe(false);
    });

    it('should return false when delete operation fails', async () => {
      const taskId = 1;
      const existingTask = sampleTasks.task1;

      // Mock getTaskById to return existing task
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingTask]),
          }),
        }),
      });

      // Mock delete operation to return 0 count
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({ count: 0 }),
      });

      const result = await deleteTask(taskId);

      expect(result).toBe(false);
    });
  });
});
