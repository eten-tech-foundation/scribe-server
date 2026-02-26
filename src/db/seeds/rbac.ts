import { db } from '@/db';
import { permissions, role_permissions } from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';

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

const ROLE_PERMISSION_MAP: { roleId: number; permissionName: string }[] = [
  { roleId: 1, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleId: 1, permissionName: PERMISSIONS.PROJECT_CREATE },
  { roleId: 1, permissionName: PERMISSIONS.PROJECT_UPDATE },
  { roleId: 1, permissionName: PERMISSIONS.PROJECT_DELETE },
  { roleId: 1, permissionName: PERMISSIONS.CONTENT_ASSIGN },
  { roleId: 1, permissionName: PERMISSIONS.USER_VIEW },
  { roleId: 1, permissionName: PERMISSIONS.USER_CREATE },
  { roleId: 1, permissionName: PERMISSIONS.USER_UPDATE },
  { roleId: 1, permissionName: PERMISSIONS.USER_DELETE },

  { roleId: 2, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleId: 2, permissionName: PERMISSIONS.CONTENT_DRAFT },
  { roleId: 2, permissionName: PERMISSIONS.CONTENT_PEER_CHECK },
  { roleId: 2, permissionName: PERMISSIONS.CONTENT_EDIT },
  { roleId: 2, permissionName: PERMISSIONS.USER_VIEW },
  { roleId: 2, permissionName: PERMISSIONS.USER_UPDATE },
];

async function seed() {
  await db
    .insert(permissions)
    .values(PERMISSION_DEFINITIONS)
    .onConflictDoNothing({ target: permissions.name });

  const allPermissions = await db
    .select({ id: permissions.id, name: permissions.name })
    .from(permissions);

  const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

  const rolePermissionRows = ROLE_PERMISSION_MAP.map(({ roleId, permissionName }) => {
    const permissionId = permissionMap.get(permissionName);
    if (!permissionId) {
      throw new Error(`Permission not found after insert: ${permissionName}`);
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
