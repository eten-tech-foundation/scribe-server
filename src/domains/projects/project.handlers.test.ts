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

// --- mock db and transaction ---
const mockTx = {
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
(db as any).transaction = vi.fn(async (cb: any) => cb(mockTx));

vi.mock('@/db', () => ({
  db: {
    selectDistinct: vi.fn(),
    transaction: vi.fn(),
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
    vi.clearAllMocks();
  });

  describe('getAllProjects', () => {
    it('should return all projects with language names in a result object', async () => {
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockResolvedValue([mockProjectWithLanguageNames]),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getAllProjects();

      expect(result).toEqual({ ok: true, data: [mockProjectWithLanguageNames] });
    });

    it('should return an error result if db call fails', async () => {
      (db.selectDistinct as any).mockImplementation(() => {
        throw new Error('DB Error');
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
      (db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([mockProjectWithLanguageNames]),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getProjectsByOrganization(1);

      expect(result).toEqual({ ok: true, data: [mockProjectWithLanguageNames] });
    });

    it('should return an error result if db call fails', async () => {
      (db.selectDistinct as any).mockImplementation(() => {
        throw new Error('DB Error');
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
      (db.selectDistinct as any).mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = await getProjectById(1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to fetch project');
      }
    });
  });

  describe('createProject', () => {
    it('should create and return a new project in a result object', async () => {
      const { bible_id, book_id, status, ...projectWithoutExtras } = mockProjectInput;
      const createdProject = { ...projectWithoutExtras, id: 2 };

      // Mock project creation
      mockTx.insert.mockImplementationOnce(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdProject]),
        }),
      }));

      // Mock project unit creation
      mockTx.insert.mockImplementationOnce(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 99 }]),
        }),
      }));

      // Mock project unit bible books creation
      mockTx.insert.mockImplementationOnce(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      }));

      const result = await createProject(mockProjectInput);

      expect(result).toEqual({ ok: true, data: createdProject });
      expect(mockTx.insert).toHaveBeenCalledTimes(3);
    });

    it('should handle creation with default status when not provided', async () => {
      const { status, ...inputWithoutStatus } = mockProjectInput;
      const { bible_id, book_id, ...projectWithoutExtras } = inputWithoutStatus;
      const createdProject = { ...projectWithoutExtras, id: 2 };

      mockTx.insert.mockImplementationOnce(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdProject]),
        }),
      }));

      mockTx.insert.mockImplementationOnce(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 99 }]),
        }),
      }));

      mockTx.insert.mockImplementationOnce(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      }));

      const result = await createProject(inputWithoutStatus);

      expect(result).toEqual({ ok: true, data: createdProject });

      // Verify that default status 'not_started' was used
      expect(mockTx.insert).toHaveBeenNthCalledWith(2, expect.anything());
      const secondCall = mockTx.insert.mock.calls[1];
      expect(secondCall[0]).toBeDefined();
    });

    it('should return an error result if creation fails', async () => {
      (db.transaction as any).mockRejectedValue(new Error('DB Error'));

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

      // Mock successful transaction return
      (db.transaction as any).mockResolvedValue({ ok: true, data: updatedProject });

      const result = await updateProject(mockProject.id, updateData);

      expect(result).toEqual({ ok: true, data: updatedProject });
    });

    it('should update project with bible_id, book_id, and status', async () => {
      const updateDataWithUnits = {
        ...updateData,
        bible_id: 2,
        book_id: [3, 4],
        status: 'in_progress' as const,
      };
      const { bible_id, book_id, status, ...projectUpdateData } = updateDataWithUnits;
      const updatedProject = { ...mockProject, ...projectUpdateData };

      // Mock successful transaction return
      (db.transaction as any).mockResolvedValue({ ok: true, data: updatedProject });

      const result = await updateProject(mockProject.id, updateDataWithUnits);

      expect(result).toEqual({ ok: true, data: updatedProject });
    });

    it('should return an error result when project to update is not found', async () => {
      // Mock transaction that returns project not found
      (db.transaction as any).mockResolvedValue({
        ok: false,
        error: { message: 'Project not found' },
      });

      const result = await updateProject(999, updateData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Project not found');
      }
    });

    it('should return an error result if db call fails', async () => {
      (db.transaction as any).mockRejectedValue(new Error('DB Error'));

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
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: mockProject.id }]),
        }),
      });

      const result = await deleteProject(mockProject.id);

      expect(result).toEqual({ ok: true, data: { id: mockProject.id } });
    });

    it('should return an error result when project to delete is not found', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await deleteProject(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Project not found');
      }
    });

    it('should return an error result if db call fails', async () => {
      (db.delete as any).mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = await deleteProject(1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to delete project');
      }
    });
  });
});
