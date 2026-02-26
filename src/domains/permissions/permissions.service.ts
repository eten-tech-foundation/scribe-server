import { eq } from 'drizzle-orm';

import type { Permission } from '@/lib/permissions';

import { db } from '@/db';
import { permissions, role_permissions } from '@/db/schema';

const cache = new Map<number, Set<string>>();

async function loadPermissionsForRole(roleId: number): Promise<Set<string>> {
  const rows = await db
    .select({ name: permissions.name })
    .from(role_permissions)
    .innerJoin(permissions, eq(permissions.id, role_permissions.permissionId))
    .where(eq(role_permissions.roleId, roleId));

  return new Set(rows.map((r) => r.name));
}

export async function roleHasPermission(roleId: number, permission: Permission): Promise<boolean> {
  if (!cache.has(roleId)) {
    const perms = await loadPermissionsForRole(roleId);
    cache.set(roleId, perms);
  }

  return cache.get(roleId)!.has(permission);
}

export function invalidatePermissionCache(roleId?: number): void {
  if (roleId !== undefined) {
    cache.delete(roleId);
  } else {
    cache.clear();
  }
}
