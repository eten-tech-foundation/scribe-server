import { eq } from 'drizzle-orm';

import type { Result } from '@/lib/types';

import { db } from '@/db';
import { books, project_unit_bible_books, project_units } from '@/db/schema';

export interface ProjectBook {
  book_id: number;
  code: string;
  eng_display_name: string;
}

export async function getBooksByProjectId(projectId: number): Promise<Result<ProjectBook[]>> {
  try {
    const projectBooks = await db
      .selectDistinct({
        book_id: books.id,
        code: books.code,
        eng_display_name: books.eng_display_name,
      })
      .from(project_units)
      .innerJoin(
        project_unit_bible_books,
        eq(project_unit_bible_books.projectUnitId, project_units.id)
      )
      .innerJoin(books, eq(books.id, project_unit_bible_books.bookId))
      .where(eq(project_units.projectId, projectId))
      .orderBy(books.id);

    return { ok: true, data: projectBooks };
  } catch {
    return { ok: false, error: { message: 'Failed to fetch project books' } };
  }
}
