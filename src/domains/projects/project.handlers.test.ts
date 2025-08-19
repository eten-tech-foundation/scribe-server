import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { resetAllMocks, sampleProjects } from '@/test/utils/test-helpers';

import {
  activateProject,
  createProject,
  deactivateProject,
  deleteProject,
  getActiveProjects,
  getAllProjects,
  getInactiveProjects,
  getProjectById,
  getProjectsByOrganization,
  getProjectsByUser,
  getProjectsCount,
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

  describe('getProjectsByUser', () => {
    it('should return projects by user ID in a result object', async () => {
      const mockProjects = [mockProject];
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockProjects),
        }),
      });

      const result = await getProjectsByUser(1);

      expect(result).toEqual({ ok: true, data: mockProjects });
    });

    it('should return an error result if no projects found for user', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await getProjectsByUser(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('No Projects found for user - or internal error');
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

  describe('getProjectsCount', () => {
    it('should return the count of projects', async () => {
      const mockCount = [{ count: 5 }];
      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockCount),
      });

      const result = await getProjectsCount();

      expect(result).toBe(1);
    });

    it('should return 0 when no projects exist', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      });

      const result = await getProjectsCount();

      expect(result).toBe(0);
    });
  });

  describe('getActiveProjects', () => {
    it('should return all active projects', async () => {
      const activeProjects = [mockProject, sampleProjects.project2];
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(activeProjects),
        }),
      });

      const result = await getActiveProjects();

      expect(result).toEqual(activeProjects);
    });

    it('should return empty array when no active projects', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await getActiveProjects();

      expect(result).toEqual([]);
    });
  });

  describe('getInactiveProjects', () => {
    it('should return all inactive projects', async () => {
      const inactiveProject = { ...mockProject, isActive: false };
      const inactiveProjects = [inactiveProject];
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(inactiveProjects),
        }),
      });

      const result = await getInactiveProjects();

      expect(result).toEqual(inactiveProjects);
    });

    it('should return empty array when no inactive projects', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await getInactiveProjects();

      expect(result).toEqual([]);
    });
  });

  describe('activateProject', () => {
    it('should activate project by setting isActive to true', async () => {
      const activatedProject = { ...mockProject, isActive: true };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockReturnValue({ returning: vi.fn().mockResolvedValue([activatedProject]) }),
        }),
      });

      const result = await activateProject(mockProject.id);

      expect(result).toEqual({ ok: true, data: activatedProject });
    });

    it('should return error if project activation fails', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await activateProject(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot update project');
      }
    });
  });

  describe('deactivateProject', () => {
    it('should deactivate project by setting isActive to false', async () => {
      const deactivatedProject = { ...mockProject, isActive: false };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockReturnValue({ returning: vi.fn().mockResolvedValue([deactivatedProject]) }),
        }),
      });

      const result = await deactivateProject(mockProject.id);

      expect(result).toEqual({ ok: true, data: deactivatedProject });
    });

    it('should return error if project deactivation fails', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await deactivateProject(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Cannot update project');
      }
    });
  });
});
