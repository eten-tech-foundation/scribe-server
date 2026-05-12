import { and, eq, isNotNull, ne } from 'drizzle-orm';

import { db } from './src/db';
import { project_units, projects, translated_verses } from './src/db/schema';

async function run() {
  const res = await db
    .select({
      content: translated_verses.content,
      projName: projects.name,
    })
    .from(translated_verses)
    .innerJoin(project_units, eq(translated_verses.projectUnitId, project_units.id))
    .innerJoin(projects, eq(project_units.projectId, projects.id))
    .where(
      and(
        eq(projects.sourceLanguage, 3),
        eq(projects.targetLanguage, 5),
        isNotNull(translated_verses.content),
        ne(translated_verses.content, '')
      )
    )
    .limit(10);

  console.log('Samples of Gujarati -> Kachi Koli translations in DB:');
  res.forEach((r) => {
    console.log(`[${r.projName}] Content: ${r.content.substring(0, 50)}...`);
  });
  process.exit(0);
}
run();
