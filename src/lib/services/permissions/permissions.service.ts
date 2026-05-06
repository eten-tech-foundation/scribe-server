import { and, eq } from 'drizzle-orm';

import type { Permission } from '@/lib/permissions';

import { db } from '@/db';
import { permissions, role_permissions, roles } from '@/db/schema';

export async function roleHasPermission(roleId: number, permission: Permission): Promise<boolean> {
  const rows = await db
    .select({ id: permissions.id })
    .from(role_permissions)
    .innerJoin(permissions, eq(permissions.id, role_permissions.permissionId))
    .where(and(eq(role_permissions.roleId, roleId), eq(permissions.name, permission)))
    .limit(1);
  return rows.length > 0;
}

export async function roleHasPermissionByName(
  roleName: string,
  permission: Permission
): Promise<boolean> {
  const rows = await db
    .select({ id: permissions.id })
    .from(role_permissions)
    .innerJoin(roles, eq(roles.id, role_permissions.roleId))
    .innerJoin(permissions, eq(permissions.id, role_permissions.permissionId))
    .where(and(eq(roles.name, roleName), eq(permissions.name, permission)))
    .limit(1);
  return rows.length > 0;
}
