import { execSync } from 'node:child_process';

import { seedDevUsers } from '@/db/seeds/dev-users';
import { seedOrganizations } from '@/db/seeds/organizations';
import { seedRbac } from '@/db/seeds/rbac';
import { seedRoles } from '@/db/seeds/roles';

async function setup() {
  console.log('=== Fluent DB Setup ===\n');

  console.log('[1/5] Running migrations...');
  execSync('npx drizzle-kit migrate', { stdio: 'inherit' });
  console.log('Migrations complete.\n');

  console.log('[2/5] Seeding organizations...');
  await seedOrganizations();
  console.log('');

  console.log('[3/5] Seeding roles...');
  await seedRoles();
  console.log('');

  console.log('[4/5] Seeding RBAC...');
  await seedRbac();
  console.log('');

  console.log('[5/5] Seeding dev users...');
  await seedDevUsers();
  console.log('');

  console.log('=== Setup complete ===');
  console.log('Manager:    admin@fluent.local     / Manager@1234    (or SEED_MANAGER_* env vars)');
  console.log('Translator: translator@fluent.local / Translator@1234 (or SEED_TRANSLATOR_* env vars)');
  process.exit(0);
}

setup().catch((err: unknown) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
