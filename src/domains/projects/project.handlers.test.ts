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

// Mock dependencies BEFORE importing modules that use them
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

// Mock chapter assignments service used by create/update flows
vi.mock('@/domains/chapter-assignments/chapter-assignments.handlers', () => ({
  createChapterAssignmentForProjectUnit: vi.fn(),
}));

// Mock project chapter assignments service used by update flow
vi.mock('@/domains/projects/chapter-assignments/project-chapter-assignments.handlers', () => ({
  deleteChapterAssignmentsByProject: vi.fn(),
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
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to fetch projects');
      }
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
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to fetch organization projects');
      }
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
      if (!result.ok) {
        expect(result.error.message).toBe('Project not found');
      }
    });

    it('should return error if db call fails', async () => {
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
    it('should create and return a new project', async () => {
      const chapterAssignmentsModule = await import(
        '@/domains/chapter-assignments/chapter-assignments.handlers'
      );
      const { bibleId, bookId, status, ...projectWithoutExtras } = mockProjectInput;
      const createdProject = { ...projectWithoutExtras, id: 2 } as any;

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

      vi.mocked(chapterAssignmentsModule.createChapterAssignmentForProjectUnit).mockResolvedValue({
        ok: true,
        data: sampleChapterAssignments as any,
      } as any);

      const result = await createProject(mockProjectInput);

      expect(result).toEqual({ ok: true, data: createdProject });
    });

    it('should return error if creation fails', async () => {
      (db.transaction as any).mockRejectedValue(new Error('DB Error'));

      const result = await createProject(mockProjectInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to create project');
      }
    });

    it('should return error if chapter assignment creation fails', async () => {
      const chapterAssignmentsModule = await import(
        '@/domains/chapter-assignments/chapter-assignments.handlers'
      );
      const { bibleId, bookId, status, ...projectWithoutExtras } = mockProjectInput;
      const createdProject = { ...projectWithoutExtras, id: 2 } as any;

      // Mock successful project creation but failed chapter assignment
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

      vi.mocked(chapterAssignmentsModule.createChapterAssignmentForProjectUnit).mockResolvedValue({
        ok: false,
        error: { message: 'Chapter assignment failed' },
      } as any);

      const result = await createProject(mockProjectInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to create project');
      }
    });
  });

  describe('updateProject', () => {
    it('should update and return the project', async () => {
      const updatedProject = { ...mockProject, ...updateData } as any;

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
      if (!result.ok) {
        expect(result.error.message).toBe('Project not found');
      }
    });

    it('should update project units when bibleId or bookId is provided', async () => {
      const chapterAssignmentsModule = await import(
        '@/domains/chapter-assignments/chapter-assignments.handlers'
      );
      const projectChapterAssignmentsModule = await import(
        '@/domains/projects/chapter-assignments/project-chapter-assignments.handlers'
      );

      const updateDataWithUnits = sampleProjects.updateProjectWithUnits;
      const updatedProject = { ...mockProject, ...updateDataWithUnits } as any;

      mockTx.update.mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedProject]),
          }),
        }),
      }));

      mockTx.delete.mockImplementationOnce(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      mockTx.insert.mockImplementationOnce(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 100 }]),
        }),
      }));

      mockTx.insert.mockImplementationOnce(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      }));
      vi.mocked(chapterAssignmentsModule.createChapterAssignmentForProjectUnit).mockResolvedValue({
        ok: true,
        data: sampleChapterAssignments as any,
      } as any);

      const result = await updateProject(1, updateDataWithUnits);

      expect(result).toEqual({ ok: true, data: updatedProject });
      expect(
        projectChapterAssignmentsModule.deleteChapterAssignmentsByProject
      ).toHaveBeenCalledWith(1);
    });

    it('should return error if update fails', async () => {
      (db.transaction as any).mockRejectedValue(new Error('DB Error'));

      const result = await updateProject(1, updateData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to update project');
      }
    });
  });

  describe('deleteProject', () => {
    it('should delete the project and return success', async () => {
      const mockDeleteQuery = {
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      };
      (db.delete as any).mockReturnValue(mockDeleteQuery);

      const result = await deleteProject(1);

      expect(result).toEqual({ ok: true, data: { id: 1 } });
    });

    it('should return error when project not found', async () => {
      const mockDeleteQuery = {
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      };
      (db.delete as any).mockReturnValue(mockDeleteQuery);

      const result = await deleteProject(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Project not found');
      }
    });

    it('should return error if deletion fails', async () => {
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
