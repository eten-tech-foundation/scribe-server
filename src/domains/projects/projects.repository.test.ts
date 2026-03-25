import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { resetAllMocks, sampleChapterAssignments, sampleProjects } from '@/test/utils/test-helpers';

import { create, getById, getByOrganization, remove, update } from './projects.repository';

// Mock dependencies BEFORE importing modules that use them
const mockTx = {
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
};

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

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

vi.mock('@/domains/chapter-assignments/chapter-assignments.service', () => ({
  createChapterAssignmentForProjectUnit: vi.fn(),
}));

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

describe('projects repository', () => {
  const mockProject = sampleProjects.project1;
  const mockRawProject = sampleProjects.projectWithLanguageNames1;
  const mockProjectInput = sampleProjects.newProject;
  const updateData = sampleProjects.updateProject;

  beforeEach(() => {
    resetAllMocks();
    (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
  });

  describe('getByOrganization', () => {
    it('should return projects filtered by organization', async () => {
      (db.selectDistinct as any).mockReturnValue(buildMockQueryChainWhere([mockRawProject]));

      const result = await getByOrganization(1);

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

      const result = await getByOrganization(1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('An unexpected error occurred');
      }
    });
  });

  describe('getById', () => {
    it('should return a single project by ID with transformed fields', async () => {
      (db.selectDistinct as any).mockReturnValue(buildMockQueryChainWhereLimit([mockRawProject]));

      const result = await getById(1);

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

      const result = await getById(1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const counts = result.data.chapterStatusCounts;
        expect(counts.not_started).toBe(3);
        for (const [, value] of Object.entries(counts)) {
          expect(typeof value).toBe('number');
        }
      }
    });

    it('should return error when project not found', async () => {
      (db.selectDistinct as any).mockReturnValue(buildMockQueryChainWhereLimit([]));

      const result = await getById(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Project not found');
      }
    });

    it('should return error if db call fails', async () => {
      (db.selectDistinct as any).mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = await getById(1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('An unexpected error occurred');
      }
    });
  });

  describe('create', () => {
    it('should create and return a new project', async () => {
      const chapterAssignmentsModule = await import(
        '@/domains/chapter-assignments/chapter-assignments.service'
      );
      const { bibleId, bookId, projectUnitStatus, ...projectWithoutExtras } = mockProjectInput;

      const createdProject = { ...projectWithoutExtras, id: 2 } as any;

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

      const result = await create(mockProjectInput);

      expect(result).toEqual({ ok: true, data: createdProject });
    });

    it('should return error if transaction fails', async () => {
      (db.transaction as any).mockRejectedValue(new Error('DB Error'));

      const result = await create(mockProjectInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('An unexpected error occurred');
      }
    });

    it('should return error if chapter assignment creation fails', async () => {
      const chapterAssignmentsModule = await import(
        '@/domains/chapter-assignments/chapter-assignments.service'
      );
      const { bibleId, bookId, projectUnitStatus, ...projectWithoutExtras } = mockProjectInput;

      const createdProject = { ...projectWithoutExtras, id: 2 } as any;

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

      const result = await create(mockProjectInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('An unexpected error occurred');
      }
    });
  });

  describe('update', () => {
    it('should update and return the project', async () => {
      const updatedProject = { ...mockProject, ...updateData } as any;

      mockTx.update.mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedProject]),
          }),
        }),
      }));

      const result = await update(1, updateData);

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

      const result = await update(999, updateData);

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

      const result = await update(1, updateDataWithUnits);

      expect(result).toEqual({ ok: true, data: updatedProject });
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

      await update(1, updateData);

      expect(mockTx.update).toHaveBeenCalledTimes(1);
    });

    it('should return error if transaction fails', async () => {
      (db.transaction as any).mockRejectedValue(new Error('DB Error'));

      const result = await update(1, updateData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('An unexpected error occurred');
      }
    });
  });

  describe('remove', () => {
    it('should delete the project and return void on success', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      const result = await remove(1);

      expect(result).toEqual({ ok: true, data: undefined });
    });

    it('should return error when project not found', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await remove(999);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Project not found');
      }
    });

    it('should return error if deletion fails', async () => {
      (db.delete as any).mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = await remove(1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('An unexpected error occurred');
      }
    });
  });
});
