import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tasks } from '@/db/schema';
import { createMockLogger, sampleTasks } from '@/test/utils/test-helpers';

import type { DatabaseService } from './database.service';
import type { LoggerService } from './logger.service';

import { TaskService } from './task.service';

// Mock the database service
const mockDatabaseService = {
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
} as unknown as DatabaseService;

describe('taskService', () => {
  let taskService: TaskService;
  let mockLogger: LoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    taskService = new TaskService(mockDatabaseService, mockLogger);
  });

  describe('getAllTasks', () => {
    it('should return all tasks', async () => {
      const mockTasks = [sampleTasks.task1, sampleTasks.task2];

      mockDatabaseService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue(mockTasks),
      });

      const result = await taskService.getAllTasks();

      expect(mockDatabaseService.db.select).toHaveBeenCalledOnce();
      expect(mockLogger.debug).toHaveBeenCalledWith('Fetching all tasks');
      expect(result).toEqual(mockTasks);
    });
  });

  describe('getTaskById', () => {
    it('should return a task when found', async () => {
      const taskId = 1;
      const mockTask = sampleTasks.task1;

      mockDatabaseService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTask]),
          }),
        }),
      });

      const result = await taskService.getTaskById(taskId);

      expect(mockDatabaseService.db.select).toHaveBeenCalledOnce();
      expect(mockLogger.debug).toHaveBeenCalledWith(`Fetching task with id: ${taskId}`);
      expect(result).toEqual(mockTask);
    });

    it('should return null when task not found', async () => {
      const taskId = 999;

      mockDatabaseService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await taskService.getTaskById(taskId);

      expect(result).toBeNull();
    });
  });

  describe('createTask', () => {
    it('should create and return a new task', async () => {
      const newTaskInput = sampleTasks.newTask;
      const createdTask = { id: 1, ...newTaskInput, createdAt: new Date(), updatedAt: new Date() };

      mockDatabaseService.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdTask]),
        }),
      });

      const result = await taskService.createTask(newTaskInput);

      expect(mockDatabaseService.db.insert).toHaveBeenCalledWith(tasks);
      expect(mockLogger.debug).toHaveBeenCalledWith('Creating new task', newTaskInput);
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
      mockDatabaseService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingTask]),
          }),
        }),
      });

      // Mock update operation
      mockDatabaseService.db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTask]),
          }),
        }),
      });

      const result = await taskService.updateTask(taskId, updateInput);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Updating task with id: ${taskId}`,
        updateInput
      );
      expect(result).toEqual(updatedTask);
    });

    it('should return null when task does not exist', async () => {
      const taskId = 999;
      const updateInput = sampleTasks.updateData;

      // Mock getTaskById to return null
      mockDatabaseService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await taskService.updateTask(taskId, updateInput);

      expect(mockLogger.warn).toHaveBeenCalledWith(`Task with id ${taskId} not found for update`);
      expect(result).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('should delete the task and return true when it exists', async () => {
      const taskId = 1;
      const existingTask = sampleTasks.task1;

      // Mock getTaskById to return existing task
      mockDatabaseService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingTask]),
          }),
        }),
      });

      // Mock delete operation
      mockDatabaseService.db.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ count: 1 }),
      });

      const result = await taskService.deleteTask(taskId);

      expect(mockDatabaseService.db.delete).toHaveBeenCalledWith(tasks);
      expect(mockLogger.debug).toHaveBeenCalledWith(`Deleting task with id: ${taskId}`);
      expect(result).toBe(true);
    });

    it('should return false when task does not exist', async () => {
      const taskId = 999;

      // Mock getTaskById to return null
      mockDatabaseService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await taskService.deleteTask(taskId);

      expect(mockLogger.warn).toHaveBeenCalledWith(`Task with id ${taskId} not found for deletion`);
      expect(result).toBe(false);
    });

    it('should return false when delete operation fails', async () => {
      const taskId = 1;
      const existingTask = sampleTasks.task1;

      // Mock getTaskById to return existing task
      mockDatabaseService.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingTask]),
          }),
        }),
      });

      // Mock delete operation to return 0 count
      mockDatabaseService.db.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ count: 0 }),
      });

      const result = await taskService.deleteTask(taskId);

      expect(result).toBe(false);
    });
  });
});
