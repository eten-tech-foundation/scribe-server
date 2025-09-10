import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { resetAllMocks, sampleChapterAssignments, sampleProjects } from '@/test/utils/test-helpers';

import {
  createProject,
  deleteProject,
  getAllProjects,
  getProjectById,
  getProjectsByOrganization,
  updateProject,
} from './projects.handlers';

// Mock db and transaction
const mockTx = {
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
};

vi.mock('@/db', () => ({
  db: {
    selectDistinct: vi.fn(),
    transaction: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/domains/chapter-assignments/chapter-assignments.handlers', () => ({
  createChapterAssignments: vi.fn(),
  deleteChapterAssignmentsByProject: vi.fn(),
  getChapterAssignmentsByProject: vi.fn(),
  getProjectChapters: vi.fn(),
}));

describe('project Handler Functions', () => {
  const mockProject = sampleProjects.project1;
  const mockProjectWithLanguageNames = sampleProjects.projectWithLanguageNames1;
  const mockProjectInput = sampleProjects.newProject;
  const updateData = sampleProjects.updateProject;

  beforeEach(() => {
    resetAllMocks();
    (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
  });

  describe('getAllProjects', () => {
    it('should return all projects with language names', async () => {
      const mockQuery = {
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
      };
      (db.selectDistinct as any).mockReturnValue(mockQuery);

      const result = await getAllProjects();

      expect(result).toEqual({ ok: true, data: [mockProjectWithLanguageNames] });
    });

    it('should return error if db call fails', async () => {
      (db.selectDistinct as any).mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = await getAllProjects();

      expect(result.ok).toBe(false);
    });
  });

  describe('getProjectsByOrganization', () => {
    it('should return projects by organization', async () => {
      const mockQuery = {
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
      };
      (db.selectDistinct as any).mockReturnValue(mockQuery);

      const result = await getProjectsByOrganization(1);

      expect(result).toEqual({ ok: true, data: [mockProjectWithLanguageNames] });
    });

    it('should return error if db call fails', async () => {
      (db.selectDistinct as any).mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = await getProjectsByOrganization(1);

      expect(result.ok).toBe(false);
    });
  });

  describe('getProjectById', () => {
    it('should return project by ID', async () => {
      const mockQuery = {
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
      };
      (db.selectDistinct as any).mockReturnValue(mockQuery);

      const result = await getProjectById(1);

      expect(result).toEqual({ ok: true, data: mockProjectWithLanguageNames });
    });

    it('should return error when project not found', async () => {
      const mockQuery = {
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
      };
      (db.selectDistinct as any).mockReturnValue(mockQuery);

      const result = await getProjectById(999);

      expect(result.ok).toBe(false);
    });
  });

  describe('createProject', () => {
    it('should create and return a new project', async () => {
      const chapterAssignmentsModule = await import(
        '@/domains/chapter-assignments/chapter-assignments.handlers'
      );
      const { bibleId, bookId, status, ...projectWithoutExtras } = mockProjectInput;
      const createdProject = { ...projectWithoutExtras, id: 2 };

      // Mock successful creation
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

      vi.mocked(chapterAssignmentsModule.createChapterAssignments).mockResolvedValue({
        ok: true,
        data: sampleChapterAssignments,
      });

      const result = await createProject(mockProjectInput);

      expect(result).toEqual({ ok: true, data: createdProject });
    });

    it('should return error if creation fails', async () => {
      (db.transaction as any).mockRejectedValue(new Error('DB Error'));

      const result = await createProject(mockProjectInput);

      expect(result.ok).toBe(false);
    });
  });

  describe('updateProject', () => {
    it('should update and return the project', async () => {
      const updatedProject = { ...mockProject, ...updateData };

      mockTx.update.mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedProject]),
          }),
        }),
      }));

      const result = await updateProject(1, updateData);

      expect(result).toEqual({ ok: true, data: updatedProject });
    });

    it('should return error when project not found', async () => {
      mockTx.update.mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      const result = await updateProject(999, updateData);

      expect(result.ok).toBe(false);
    });
  });

  describe('deleteProject', () => {
    it('should delete the project and return success', async () => {
      mockTx.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      mockTx.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      const result = await deleteProject(1);

      expect(result).toEqual({ ok: true, data: { id: 1 } });
    });

    it('should return error when project not found', async () => {
      mockTx.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      mockTx.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await deleteProject(999);

      expect(result.ok).toBe(false);
    });

    it('should return error if deletion fails', async () => {
      (db.transaction as any).mockRejectedValue(new Error('DB Error'));

      const result = await deleteProject(1);

      expect(result.ok).toBe(false);
    });
  });
});
