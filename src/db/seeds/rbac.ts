import { db } from '@/db';
import { permissions, role_permissions, roles } from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { ROLES } from '@/lib/roles';

const PERMISSION_DEFINITIONS = [
  { name: PERMISSIONS.PROJECT_VIEW, description: 'View projects' },
  { name: PERMISSIONS.PROJECT_CREATE, description: 'Create new projects' },
  { name: PERMISSIONS.PROJECT_UPDATE, description: 'Update existing projects' },
  { name: PERMISSIONS.PROJECT_DELETE, description: 'Delete projects' },
  { name: PERMISSIONS.CONTENT_ASSIGN, description: 'Assign chapters to users' },
  { name: PERMISSIONS.CONTENT_DRAFT, description: 'Draft (translate) chapters' },
  { name: PERMISSIONS.CONTENT_PEER_CHECK, description: 'Perform peer check on chapters' },
  { name: PERMISSIONS.CONTENT_EDIT, description: 'Edit content after peer check' },
  { name: PERMISSIONS.USER_VIEW, description: 'View user profiles' },
  { name: PERMISSIONS.USER_CREATE, description: 'Create new users' },
  { name: PERMISSIONS.USER_UPDATE, description: 'Update user profiles' },
  { name: PERMISSIONS.USER_DELETE, description: 'Delete user' },
];

const ROLE_PERMISSION_MAP = [
  { roleName: ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.PROJECT_CREATE },
  { roleName: ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.PROJECT_UPDATE },
  { roleName: ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.PROJECT_DELETE },
  { roleName: ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.CONTENT_ASSIGN },
  { roleName: ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.USER_VIEW },
  { roleName: ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.USER_CREATE },
  { roleName: ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.USER_UPDATE },
  { roleName: ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.USER_DELETE },

  { roleName: ROLES.TRANSLATOR, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: ROLES.TRANSLATOR, permissionName: PERMISSIONS.CONTENT_DRAFT },
  { roleName: ROLES.TRANSLATOR, permissionName: PERMISSIONS.CONTENT_PEER_CHECK },
  { roleName: ROLES.TRANSLATOR, permissionName: PERMISSIONS.CONTENT_EDIT },
  { roleName: ROLES.TRANSLATOR, permissionName: PERMISSIONS.USER_VIEW },
  { roleName: ROLES.TRANSLATOR, permissionName: PERMISSIONS.USER_UPDATE },
];

async function seed() {
  await db
    .insert(permissions)
    .values(PERMISSION_DEFINITIONS)
    .onConflictDoNothing({ target: permissions.name });

  const allRoles = await db.select({ id: roles.id, name: roles.name }).from(roles);

  const allPermissions = await db
    .select({ id: permissions.id, name: permissions.name })
    .from(permissions);

  const roleMap = new Map(allRoles.map((r) => [r.name, r.id]));
  const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

  const rolePermissionRows = ROLE_PERMISSION_MAP.map(({ roleName, permissionName }) => {
    const roleId = roleMap.get(roleName);
    const permissionId = permissionMap.get(permissionName);

    if (!roleId) {
      throw new Error(`Role not found in DB: ${roleName}`);
    }
    if (!permissionId) {
      throw new Error(`Permission not found in DB: ${permissionName}`);
    }

    return { roleId, permissionId };
  });

  await db.insert(role_permissions).values(rolePermissionRows).onConflictDoNothing();

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
