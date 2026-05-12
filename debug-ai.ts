import { eq } from 'drizzle-orm';

import { db } from './src/db';
import {
  bible_texts,
  languages,
  project_units,
  projects,
  translated_verses,
} from './src/db/schema';

async function run() {
  console.log('=== DB Diagnostic Script ===');

  try {
    // 1. Let's see what projects exist
    console.log('\n--- Projects ---');
    const allProjects = await db.select().from(projects);
    allProjects.forEach((p) =>
      console.log(
        `Project ${p.id}: ${p.name} (Source: ${p.sourceLanguage}, Target: ${p.targetLanguage})`
      )
    );

    // 2. Let's see what languages exist
    console.log('\n--- Languages ---');
    const allLanguages = await db.select().from(languages);
    allLanguages.forEach((l) => console.log(`Lang ${l.id}: ${l.langName}`));

    // 3. Let's see what project units exist
    console.log('\n--- Project Units ---');
    const allUnits = await db.select().from(project_units);
    allUnits.forEach((u) =>
      console.log(`Unit ${u.id} -> Project ${u.projectId} (Status: ${u.status})`)
    );

    // 4. Let's count translated verses per project unit
    console.log('\n--- Translated Verses Count ---');
    const allTranslations = await db
      .select({
        id: translated_verses.id,
        projectUnitId: translated_verses.projectUnitId,
        content: translated_verses.content,
        bibleTextId: translated_verses.bibleTextId,
      })
      .from(translated_verses);

    console.log(`Total translated verses in DB: ${allTranslations.length}`);

    const unitCounts: Record<number, number> = {};
    allTranslations.forEach((t) => {
      if (t.content && t.content.trim() !== '') {
        unitCounts[t.projectUnitId] = (unitCounts[t.projectUnitId] || 0) + 1;
      }
    });
    console.log('Valid translations per Unit ID:', unitCounts);

    // 5. Let's check a sample of valid translations
    const validTranslations = allTranslations.filter((t) => t.content && t.content.trim() !== '');
    if (validTranslations.length > 0) {
      console.log('\n--- Sample valid translation ---');
      const sample = validTranslations[0];
      console.log(sample);

      // Find its bible text
      const text = await db
        .select()
        .from(bible_texts)
        .where(eq(bible_texts.id, sample.bibleTextId));
      console.log('Source text:', text[0]);
    }
  } catch (error) {
    console.error('DB Error:', error);
  } finally {
    process.exit(0);
  }
}

run().catch(console.error);
