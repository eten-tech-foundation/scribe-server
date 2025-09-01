import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { resetAllMocks, sampleProjects } from '@/test/utils/test-helpers';

import {
  createProject,
  deleteProject,
  getAllProjects,
  getProjectById,
  getProjectsAssignedToUser,
  getProjectsByOrganization,
  updateProject,
} from './projects.handlers';

vi.mock('@/db', () => ({
  db: {
    selectDistinct: vi.fn(),
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
  const mockProjectWithLanguageNames = sampleProjects.projectWithLanguageNames1;
  const mockProjectInput = sampleProjects.newProject;
  const updateData = sampleProjects.updateProject;

  beforeEach(() => {
    resetAllMocks();
  });

  describe('getAllProjects', () => {
    it('should return all projects with language names in a result object', async () => {
      const mockProjects = [mockProjectWithLanguageNames];
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockResolvedValue(mockProjects),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getAllProjects();

      expect(result).toEqual({ ok: true, data: mockProjects });
    });

    it('should return an error result if db call fails', async () => {
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockRejectedValue(new Error('DB Error')),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getAllProjects();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to fetch projects');
      }
    });
  });

  describe('getProjectsByOrganization', () => {
    it('should return projects by organization with language names in a result object', async () => {
      const mockProjects = [mockProjectWithLanguageNames];
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(mockProjects),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getProjectsByOrganization(1);

      expect(result).toEqual({ ok: true, data: mockProjects });
    });

    it('should return an error result if db call fails', async () => {
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockRejectedValue(new Error('DB Error')),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getProjectsByOrganization(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to fetch organization projects');
      }
    });
  });

  describe('getProjectById', () => {
    it('should return project by ID with language names in a result object', async () => {
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([mockProjectWithLanguageNames]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getProjectById(mockProject.id);

      expect(result).toEqual({ ok: true, data: mockProjectWithLanguageNames });
    });

    it('should return an error result when project not found', async () => {
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getProjectById(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Project not found');
      }
    });

    it('should return an error result if db call fails', async () => {
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                      limit: vi.fn().mockRejectedValue(new Error('DB Error')),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getProjectById(1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to fetch project');
      }
    });
  });

  describe('getProjectsAssignedToUser', () => {
    it('should return projects assigned to user with language names in a result object', async () => {
      const mockProjects = [mockProjectWithLanguageNames];
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(mockProjects),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getProjectsAssignedToUser(1);

      expect(result).toEqual({ ok: true, data: mockProjects });
    });

    it('should return an error result if db call fails', async () => {
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockRejectedValue(new Error('DB Error')),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getProjectsAssignedToUser(1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Failed to fetch user's assigned projects");
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
        values: vi
          .fn()
          .mockReturnValue({ returning: vi.fn().mockRejectedValue(new Error('DB Error')) }),
      });

      const result = await createProject(mockProjectInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to create project');
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
        expect(result.error.message).toBe('Project not found');
      }
    });

    it('should return an error result if db call fails', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockReturnValue({ returning: vi.fn().mockRejectedValue(new Error('DB Error')) }),
        }),
      });

      const result = await updateProject(1, updateData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to update project');
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

      expect(result).toEqual({ ok: true, data: { id: mockProject.id } });
    });

    it('should return an error result when project to delete is not found', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      });

      const result = await deleteProject(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Project not found');
      }
    });

    it('should return an error result if db call fails', async () => {
      (db.delete as any).mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({ returning: vi.fn().mockRejectedValue(new Error('DB Error')) }),
      });

      const result = await deleteProject(1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to delete project');
      }
    });
  });
});
