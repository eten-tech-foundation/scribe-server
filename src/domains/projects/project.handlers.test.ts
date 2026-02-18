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
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      as: vi.fn(() => ({
        projectId: undefined,
        lastChapterActivity: undefined,
        status: undefined,
        count: undefined,
        counts: undefined,
      })),
    })),
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

/**
 * For getAllProjects the chain ends at groupBy (no where/limit).
 * We mock groupBy to resolve directly.
 */
function buildMockQueryChainDirect(terminalValue: unknown) {
  const groupByMock = vi.fn().mockResolvedValue(terminalValue);
  const leftJoin2Mock = vi.fn().mockReturnValue({ groupBy: groupByMock });
  const leftJoin1Mock = vi.fn().mockReturnValue({ leftJoin: leftJoin2Mock });
  const innerJoin5Mock = vi.fn().mockReturnValue({ leftJoin: leftJoin1Mock });
  const innerJoin4Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin5Mock });
  const innerJoin3Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin4Mock });
  const innerJoin2Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin3Mock });
  const innerJoin1Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin2Mock });
  const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoin1Mock });
  return { from: fromMock };
}

/**
 * For getProjectsByOrganization the chain ends at groupBy().where().
 */
function buildMockQueryChainWhere(terminalValue: unknown) {
  const whereMock = vi.fn().mockResolvedValue(terminalValue);
  const groupByMock = vi.fn().mockReturnValue({ where: whereMock });
  const leftJoin2Mock = vi.fn().mockReturnValue({ groupBy: groupByMock });
  const leftJoin1Mock = vi.fn().mockReturnValue({ leftJoin: leftJoin2Mock });
  const innerJoin5Mock = vi.fn().mockReturnValue({ leftJoin: leftJoin1Mock });
  const innerJoin4Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin5Mock });
  const innerJoin3Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin4Mock });
  const innerJoin2Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin3Mock });
  const innerJoin1Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin2Mock });
  const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoin1Mock });
  return { from: fromMock };
}

/**
 * For getProjectById the chain ends at groupBy().where().limit().
 */
function buildMockQueryChainWhereLimit(terminalValue: unknown) {
  const limitMock = vi.fn().mockResolvedValue(terminalValue);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const groupByMock = vi.fn().mockReturnValue({ where: whereMock });
  const leftJoin2Mock = vi.fn().mockReturnValue({ groupBy: groupByMock });
  const leftJoin1Mock = vi.fn().mockReturnValue({ leftJoin: leftJoin2Mock });
  const innerJoin5Mock = vi.fn().mockReturnValue({ leftJoin: leftJoin1Mock });
  const innerJoin4Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin5Mock });
  const innerJoin3Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin4Mock });
  const innerJoin2Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin3Mock });
  const innerJoin1Mock = vi.fn().mockReturnValue({ innerJoin: innerJoin2Mock });
  const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoin1Mock });
  return { from: fromMock };
}

describe('project Handler Functions', () => {
  const mockProject = sampleProjects.project1;
  const mockRawProject = sampleProjects.projectWithLanguageNames1; // raw DB row (has counts)
  const mockProjectInput = sampleProjects.newProject;
  const updateData = sampleProjects.updateProject;

  beforeEach(() => {
    resetAllMocks();
    (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
  });

  describe('getAllProjects', () => {
    it('should return all projects with language names (including chapterStatusCounts)', async () => {
      (db.selectDistinct as any).mockReturnValue(buildMockQueryChainDirect([mockRawProject]));

      const result = await getAllProjects();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject({
          id: mockRawProject.id,
          name: mockRawProject.name,
          sourceLanguageName: mockRawProject.sourceLanguageName,
          targetLanguageName: mockRawProject.targetLanguageName,
          sourceName: mockRawProject.sourceName,
        });
        // transformProjectData guarantees these fields exist
        expect(result.data[0].chapterStatusCounts).toBeDefined();
        expect(result.data[0].workflowConfig).toBeDefined();
        expect(Array.isArray(result.data[0].workflowConfig)).toBe(true);
      }
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
    it('should return projects filtered by organization', async () => {
      (db.selectDistinct as any).mockReturnValue(buildMockQueryChainWhere([mockRawProject]));

      const result = await getProjectsByOrganization(1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject({
          id: mockRawProject.id,
          organization: mockRawProject.organization,
        });
        expect(result.data[0].chapterStatusCounts).toBeDefined();
        expect(result.data[0].workflowConfig).toBeDefined();
      }
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
    it('should return a single project by ID with transformed fields', async () => {
      (db.selectDistinct as any).mockReturnValue(buildMockQueryChainWhereLimit([mockRawProject]));

      const result = await getProjectById(1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toMatchObject({
          id: mockRawProject.id,
          name: mockRawProject.name,
          sourceLanguageName: mockRawProject.sourceLanguageName,
          targetLanguageName: mockRawProject.targetLanguageName,
        });
        expect(result.data.chapterStatusCounts).toBeDefined();
        expect(result.data.workflowConfig).toBeDefined();
      }
    });

    it('should fill missing chapter statuses with zero counts', async () => {
      const rawWithPartialCounts = {
        ...mockRawProject,
        counts: { not_started: 3 },
      };
      (db.selectDistinct as any).mockReturnValue(
        buildMockQueryChainWhereLimit([rawWithPartialCounts])
      );

      const result = await getProjectById(1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Every enum status should be present
        const counts = result.data.chapterStatusCounts;
        expect(counts.not_started).toBe(3);
        // Other statuses default to 0
        for (const [, value] of Object.entries(counts)) {
          expect(typeof value).toBe('number');
        }
      }
    });

    it('should return error when project not found', async () => {
      (db.selectDistinct as any).mockReturnValue(buildMockQueryChainWhereLimit([]));

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
      const { bibleId, bookId, projectUnitStatus, ...projectWithoutExtras } = mockProjectInput;

      const createdProject = { ...projectWithoutExtras, id: 2 } as any;

      // Mock successful creation
      mockTx.insert
        .mockImplementationOnce(() => ({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdProject]),
          }),
        }))
        .mockImplementationOnce(() => ({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 99 }]),
          }),
        }))
        .mockImplementationOnce(() => ({
          values: vi.fn().mockResolvedValue(undefined),
        }));

      vi.mocked(chapterAssignmentsModule.createChapterAssignmentForProjectUnit).mockResolvedValue({
        ok: true,
        data: sampleChapterAssignments as any,
      } as any);

      const result = await createProject(mockProjectInput);

      expect(result).toEqual({ ok: true, data: createdProject });
    });

    it('should return error if transaction fails', async () => {
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
      const { bibleId, bookId, projectUnitStatus, ...projectWithoutExtras } = mockProjectInput;

      const createdProject = { ...projectWithoutExtras, id: 2 } as any;

      // Mock successful project creation but failed chapter assignment
      mockTx.insert
        .mockImplementationOnce(() => ({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdProject]),
          }),
        }))
        .mockImplementationOnce(() => ({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 99 }]),
          }),
        }))
        .mockImplementationOnce(() => ({
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

    it('should also update project_units when projectUnitStatus is provided', async () => {
      const updateDataWithUnits = sampleProjects.updateProjectWithUnits;
      const updatedProject = { ...mockProject, ...updateDataWithUnits } as any;

      mockTx.update
        .mockImplementationOnce(() => ({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updatedProject]),
            }),
          }),
        }))
        .mockImplementationOnce(() => ({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }));

      const result = await updateProject(1, updateDataWithUnits);

      expect(result).toEqual({ ok: true, data: updatedProject });
      // Both projects and project_units updates were called
      expect(mockTx.update).toHaveBeenCalledTimes(2);
    });

    it('should NOT call a second update when projectUnitStatus is absent', async () => {
      const updatedProject = { ...mockProject, ...updateData } as any;

      mockTx.update.mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedProject]),
          }),
        }),
      }));

      await updateProject(1, updateData);

      expect(mockTx.update).toHaveBeenCalledTimes(1);
    });

    it('should return error if transaction fails', async () => {
      (db.transaction as any).mockRejectedValue(new Error('DB Error'));

      const result = await updateProject(1, updateData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to update project');
      }
    });
  });

  describe('deleteProject', () => {
    it('should delete the project and return its id', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      const result = await deleteProject(1);

      expect(result).toEqual({ ok: true, data: { id: 1 } });
    });

    it('should return error when project not found', async () => {
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
