import type { Context } from 'hono';

import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoggerService } from '@/services/logger.service';
import type { TaskService } from '@/services/task.service';

import { TaskController } from './task.controller';
import { ZOD_ERROR_CODES } from '../lib/constants';

const mockTaskService = {
  getAllTasks: vi.fn(),
  getTaskById: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
} as unknown as TaskService;

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as LoggerService;

function createMockContext(overrides: Partial<Context> = {}): Context {
  const mockContext = {
    json: vi.fn((data, status?) => ({ data, status }) as any),
    body: vi.fn((data, status?) => ({ data, status }) as any),
    req: {
      json: vi.fn(),
      param: vi.fn(),
    },
    ...overrides,
  } as unknown as Context;

  return mockContext;
}

describe('taskController', () => {
  let taskController: TaskController;

  beforeEach(() => {
    vi.clearAllMocks();
    taskController = new TaskController(mockTaskService, mockLogger);
  });

  describe('list', () => {
    it('should return all tasks', async () => {
      const mockTasks = [
        { id: 1, name: 'Task 1', done: false, createdAt: new Date(), updatedAt: new Date() },
        { id: 2, name: 'Task 2', done: true, createdAt: new Date(), updatedAt: new Date() },
      ];

      mockTaskService.getAllTasks = vi.fn().mockResolvedValue(mockTasks);
      const ctx = createMockContext();

      await taskController.list(ctx);

      expect(mockTaskService.getAllTasks).toHaveBeenCalledOnce();
      expect(mockLogger.info).toHaveBeenCalledWith('Getting all tasks');
      expect(ctx.json).toHaveBeenCalledWith(mockTasks);
    });
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const newTask = { name: 'New Task', done: false };
      const createdTask = { id: 1, ...newTask, createdAt: new Date(), updatedAt: new Date() };

      const ctx = createMockContext();
      ctx.req.json = vi.fn().mockResolvedValue(newTask);
      mockTaskService.createTask = vi.fn().mockResolvedValue(createdTask);

      await taskController.create(ctx);

      expect(ctx.req.json).toHaveBeenCalledOnce();
      expect(mockTaskService.createTask).toHaveBeenCalledWith(newTask);
      expect(mockLogger.info).toHaveBeenCalledWith('Creating task', { task: newTask });
      expect(ctx.json).toHaveBeenCalledWith(createdTask, HttpStatusCodes.OK);
    });
  });

  describe('getOne', () => {
    it('should return a task when found', async () => {
      const taskId = '1';
      const mockTask = {
        id: 1,
        name: 'Task 1',
        done: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ctx = createMockContext();
      ctx.req.param = vi.fn().mockReturnValue({ id: taskId });
      mockTaskService.getTaskById = vi.fn().mockResolvedValue(mockTask);

      await taskController.getOne(ctx);

      expect(ctx.req.param).toHaveBeenCalledOnce();
      expect(mockTaskService.getTaskById).toHaveBeenCalledWith(1);
      expect(mockLogger.info).toHaveBeenCalledWith('Getting task 1');
      expect(ctx.json).toHaveBeenCalledWith(mockTask, HttpStatusCodes.OK);
    });

    it('should return 404 when task not found', async () => {
      const taskId = '999';

      const ctx = createMockContext();
      ctx.req.param = vi.fn().mockReturnValue({ id: taskId });
      mockTaskService.getTaskById = vi.fn().mockResolvedValue(null);

      await taskController.getOne(ctx);

      expect(mockTaskService.getTaskById).toHaveBeenCalledWith(999);
      expect(ctx.json).toHaveBeenCalledWith(
        { message: HttpStatusPhrases.NOT_FOUND },
        HttpStatusCodes.NOT_FOUND
      );
    });
  });

  describe('patch', () => {
    it('should update a task when valid updates provided', async () => {
      const taskId = '1';
      const updates = { name: 'Updated Task' };
      const updatedTask = {
        id: 1,
        name: 'Updated Task',
        done: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ctx = createMockContext();
      ctx.req.param = vi.fn().mockReturnValue({ id: taskId });
      ctx.req.json = vi.fn().mockResolvedValue(updates);
      mockTaskService.updateTask = vi.fn().mockResolvedValue(updatedTask);

      await taskController.patch(ctx);

      expect(ctx.req.param).toHaveBeenCalledOnce();
      expect(ctx.req.json).toHaveBeenCalledOnce();
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(1, updates);
      expect(mockLogger.info).toHaveBeenCalledWith('Updating task 1', { updates });
      expect(ctx.json).toHaveBeenCalledWith(updatedTask, HttpStatusCodes.OK);
    });

    it('should return validation error when no updates provided', async () => {
      const taskId = '1';
      const updates = {};

      const ctx = createMockContext();
      ctx.req.param = vi.fn().mockReturnValue({ id: taskId });
      ctx.req.json = vi.fn().mockResolvedValue(updates);

      await taskController.patch(ctx);

      expect(ctx.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            issues: [
              {
                code: ZOD_ERROR_CODES.INVALID_UPDATES,
                path: [],
                message: 'No updates provided',
              },
            ],
            name: 'ZodError',
          },
        },
        HttpStatusCodes.UNPROCESSABLE_ENTITY
      );
    });

    it('should return 404 when task not found', async () => {
      const taskId = '999';
      const updates = { name: 'Updated Task' };

      const ctx = createMockContext();
      ctx.req.param = vi.fn().mockReturnValue({ id: taskId });
      ctx.req.json = vi.fn().mockResolvedValue(updates);
      mockTaskService.updateTask = vi.fn().mockResolvedValue(null);

      await taskController.patch(ctx);

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(999, updates);
      expect(ctx.json).toHaveBeenCalledWith(
        { message: HttpStatusPhrases.NOT_FOUND },
        HttpStatusCodes.NOT_FOUND
      );
    });
  });

  describe('remove', () => {
    it('should delete a task when found', async () => {
      const taskId = '1';

      const ctx = createMockContext();
      ctx.req.param = vi.fn().mockReturnValue({ id: taskId });
      mockTaskService.deleteTask = vi.fn().mockResolvedValue(true);

      await taskController.remove(ctx);

      expect(ctx.req.param).toHaveBeenCalledOnce();
      expect(mockTaskService.deleteTask).toHaveBeenCalledWith(1);
      expect(mockLogger.info).toHaveBeenCalledWith('Deleting task 1');
      expect(ctx.body).toHaveBeenCalledWith(null, HttpStatusCodes.NO_CONTENT);
    });

    it('should return 404 when task not found', async () => {
      const taskId = '999';

      const ctx = createMockContext();
      ctx.req.param = vi.fn().mockReturnValue({ id: taskId });
      mockTaskService.deleteTask = vi.fn().mockResolvedValue(false);

      await taskController.remove(ctx);

      expect(mockTaskService.deleteTask).toHaveBeenCalledWith(999);
      expect(ctx.json).toHaveBeenCalledWith(
        { message: HttpStatusPhrases.NOT_FOUND },
        HttpStatusCodes.NOT_FOUND
      );
    });
  });
});
