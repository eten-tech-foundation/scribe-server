import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { resetAllMocks, sampleProjects } from '@/test/utils/test-helpers';

import {
  createProject,
  deleteProject,
  getAllProjects,
  getProjectById,
  getProjectsByOrganization,
  updateProject,
} from './projects.handlers';

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

describe('project Handler Functions', () => {
  const mockProject = sampleProjects.project1;
  const mockProjectInput = sampleProjects.newProject;
  const updateData = sampleProjects.updateProject;

  beforeEach(() => {
    resetAllMocks();
  });

  describe('getAllProjects', () => {
    it('should return all projects in a result object', async () => {
      const mockProjects = [mockProject];
      (db.select as any).mockReturnValue({ from: vi.fn().mockResolvedValue(mockProjects) });

      const result = await getAllProjects();

      expect(result).toEqual({ ok: true, data: mockProjects });
    });

    it('should return an error result if db call fails', async () => {
      (db.select as any).mockReturnValue({ from: vi.fn().mockResolvedValue(undefined) });

      const result = await getAllProjects();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('No Projects found - or internal error');
      }
    });
  });

  describe('getProjectsByOrganization', () => {
    it('should return projects by organization in a result object', async () => {
      const mockProjects = [mockProject];
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockProjects),
          }),
        }),
      });

      const result = await getProjectsByOrganization(1);

      expect(result).toEqual({ ok: true, data: mockProjects });
    });

    it('should return an error result if no projects found in organization', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });

      const result = await getProjectsByOrganization(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('No Projects found in organization - or internal error');
      }
    });
  });

  describe('getProjectById', () => {
    it('should return project by ID in a result object', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockProject]) }),
        }),
      });

      const result = await getProjectById(mockProject.id);

      expect(result).toEqual({ ok: true, data: mockProject });
    });

    it('should return an error result when project not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await getProjectById(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Project not found');
      }
    });
  });

  describe('createProject', () => {
    it('should create and return a new project in a result object', async () => {
      const createdProject = {
        ...mockProjectInput,
        id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([createdProject]) }),
      });

      const result = await createProject(mockProjectInput);

      expect(result).toEqual({ ok: true, data: createdProject });
    });

    it('should return an error result if creation fails', async () => {
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      });

      const result = await createProject(mockProjectInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Unable to create project');
      }
    });
  });

  describe('updateProject', () => {
    it('should update and return the project in a result object', async () => {
      const updatedProject = { ...mockProject, ...updateData };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockReturnValue({ returning: vi.fn().mockResolvedValue([updatedProject]) }),
        }),
      });

      const result = await updateProject(mockProject.id, updateData);

      expect(result).toEqual({ ok: true, data: updatedProject });
    });

    it('should return an error result when project to update is not found', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await updateProject(999, updateData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot update project');
      }
    });
  });

  describe('deleteProject', () => {
    it('should delete the project and return a success result', async () => {
      (db.delete as any).mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: mockProject.id }]) }),
      });

      const result = await deleteProject(mockProject.id);

      expect(result).toEqual({ ok: true, data: true });
    });

    it('should return an error result when project to delete is not found', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      });

      const result = await deleteProject(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot delete project');
      }
    });
  });
});
