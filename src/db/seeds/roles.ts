import { db } from '@/db';
import { roles } from '@/db/schema';
import { ROLES } from '@/lib/roles';

const ROLE_DEFINITIONS = Object.values(ROLES).map((name) => ({ name }));

async function seed() {
  await db.insert(roles).values(ROLE_DEFINITIONS).onConflictDoNothing({ target: roles.name });

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
