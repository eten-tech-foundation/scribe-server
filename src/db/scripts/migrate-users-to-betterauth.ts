import { eq, isNull } from 'drizzle-orm';
import crypto from 'node:crypto';

import { logger } from '../../lib/logger';
import { db } from '../index';
import * as schema from '../schema';

/**
 * Idempotent script to migrate existing Fluent users to BetterAuth records.
 * Creates an authUser record for each existing user missing an authUserId.
 */
async function migrateUsers() {
  logger.info('Starting user migration to BetterAuth...');

  try {
    // Find all users without an auth identity
    const usersToMigrate = await db
      .select()
      .from(schema.users)
      .where(isNull(schema.users.authUserId));

    if (usersToMigrate.length === 0) {
      logger.info('No users pending migration. Exiting.');
      process.exit(0);
    }

    logger.info(`Found ${usersToMigrate.length} users to migrate.`);

    for (const user of usersToMigrate) {
      const authUserId = crypto.randomUUID();

      const email = user.email || `${user.username}@fluent.bible`;
      const name = user.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : user.username;

      logger.info(`Migrating user ${user.username} (${email})...`);

      // 1. Create BetterAuth user record
      await db.insert(schema.authUser).values({
        id: authUserId,
        email,
        name,
        emailVerified: user.status === 'verified',
        createdAt: user.createdAt || new Date(),
        updatedAt: user.updatedAt || new Date(),
      });

      // 2. Link application user to BetterAuth user
      await db.update(schema.users).set({ authUserId }).where(eq(schema.users.id, user.id));

      logger.info(`Successfully migrated user ${user.username} -> authUserId: ${authUserId}`);
    }

    logger.info('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateUsers();
