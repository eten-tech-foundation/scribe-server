import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

import { logger } from '../../lib/logger';
import { db } from '../index';
import * as schema from '../schema';

async function setPassword() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error('Usage: npm run db:set-password <email> <password>');
    process.exit(1);
  }

  const email = args[0].toLowerCase();
  const rawPassword = args[1];

  try {
    // 1. Find the BetterAuth user by email
    const [user] = await db.select().from(schema.authUser).where(eq(schema.authUser.email, email));

    if (!user) {
      logger.error(`User with email ${email} not found in auth_user table.`);
      logger.error(`Please ensure they are migrated first or create them in the DB.`);
      process.exit(1);
    }

    // 2. Hash the password using Better Auth's internal utility
    const hashedPassword = await hashPassword(rawPassword);

    // 3. Check if credential account already exists
    const existingAccounts = await db
      .select()
      .from(schema.authAccount)
      .where(eq(schema.authAccount.userId, user.id));

    const credentialAccount = existingAccounts.find((acc) => acc.providerId === 'credential');

    if (credentialAccount) {
      // Update existing credential account password
      await db
        .update(schema.authAccount)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(schema.authAccount.id, credentialAccount.id));

      logger.info(`Successfully updated password for ${email}`);
    } else {
      // Create new credential account for BetterAuth
      await db.insert(schema.authAccount).values({
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: email,
        providerId: 'credential',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      logger.info(`Successfully created password credentials for ${email}`);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Failed to set password:', error);
    process.exit(1);
  }
}

setPassword();
