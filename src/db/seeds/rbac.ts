import { db } from '@/db';
import { permissions, role_permissions, roles } from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { ORG_ROLES, PROJECT_ROLES } from '@/lib/roles';

const PERMISSION_DEFINITIONS = [
  { name: PERMISSIONS.PROJECT_VIEW, description: 'View projects' },
  { name: PERMISSIONS.PROJECT_CREATE, description: 'Create new projects' },
  { name: PERMISSIONS.PROJECT_UPDATE, description: 'Update existing projects' },
  { name: PERMISSIONS.PROJECT_DELETE, description: 'Delete projects' },
  { name: PERMISSIONS.CONTENT_ASSIGN, description: 'Assign chapter assignment' },
  { name: PERMISSIONS.CONTENT_UPDATE, description: 'Update chapter assignment content' },
  { name: PERMISSIONS.USER_VIEW, description: 'View user profiles' },
  { name: PERMISSIONS.USER_CREATE, description: 'Create new users' },
  { name: PERMISSIONS.USER_UPDATE, description: 'Update user profiles' },
  { name: PERMISSIONS.USER_DELETE, description: 'Delete user' },
  { name: PERMISSIONS.ORG_MEMBER_VIEW, description: 'View org members' },
  { name: PERMISSIONS.ORG_MEMBER_INVITE, description: 'Invite users to org' },
  { name: PERMISSIONS.ORG_MEMBER_UPDATE, description: 'Update org member roles' },
  { name: PERMISSIONS.ORG_MEMBER_REMOVE, description: 'Remove org members' },
];

const ROLE_DEFINITIONS = [
  { name: ORG_ROLES.ORG_OWNER },
  { name: ORG_ROLES.ORG_MANAGER },
  { name: ORG_ROLES.MEMBER },
  { name: PROJECT_ROLES.PROJECT_MANAGER },
  { name: PROJECT_ROLES.TRANSLATOR },
  { name: PROJECT_ROLES.PEER_CHECKER },
  { name: PROJECT_ROLES.OBSERVER },
];

const ROLE_PERMISSION_MAP: { roleName: string; permissionName: string }[] = [
  // Org Owner — everything
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.PROJECT_CREATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.PROJECT_UPDATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.PROJECT_DELETE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.CONTENT_ASSIGN },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.CONTENT_UPDATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.USER_VIEW },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.USER_CREATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.USER_UPDATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.USER_DELETE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.ORG_MEMBER_VIEW },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.ORG_MEMBER_INVITE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.ORG_MEMBER_UPDATE },
  { roleName: ORG_ROLES.ORG_OWNER, permissionName: PERMISSIONS.ORG_MEMBER_REMOVE },

  // Org Manager — manage projects and users
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.PROJECT_CREATE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.PROJECT_UPDATE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.PROJECT_DELETE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.USER_VIEW },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.USER_CREATE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.USER_UPDATE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.ORG_MEMBER_VIEW },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.ORG_MEMBER_INVITE },
  { roleName: ORG_ROLES.ORG_MANAGER, permissionName: PERMISSIONS.ORG_MEMBER_REMOVE },

  // Member (org-level) — view only at org level
  { roleName: ORG_ROLES.MEMBER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: ORG_ROLES.MEMBER, permissionName: PERMISSIONS.USER_VIEW },
  { roleName: ORG_ROLES.MEMBER, permissionName: PERMISSIONS.ORG_MEMBER_VIEW },

  // Project Manager (project-level)
  { roleName: PROJECT_ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: PROJECT_ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.PROJECT_UPDATE },
  { roleName: PROJECT_ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.CONTENT_ASSIGN },
  { roleName: PROJECT_ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.CONTENT_UPDATE },
  { roleName: PROJECT_ROLES.PROJECT_MANAGER, permissionName: PERMISSIONS.USER_VIEW },

  // Translator (project-level)
  { roleName: PROJECT_ROLES.TRANSLATOR, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: PROJECT_ROLES.TRANSLATOR, permissionName: PERMISSIONS.CONTENT_UPDATE },
  { roleName: PROJECT_ROLES.TRANSLATOR, permissionName: PERMISSIONS.USER_VIEW },

  // Peer Checker (project-level)
  { roleName: PROJECT_ROLES.PEER_CHECKER, permissionName: PERMISSIONS.PROJECT_VIEW },
  { roleName: PROJECT_ROLES.PEER_CHECKER, permissionName: PERMISSIONS.CONTENT_UPDATE },

  // Observer (project-level) — read-only
  { roleName: PROJECT_ROLES.OBSERVER, permissionName: PERMISSIONS.PROJECT_VIEW },
];

async function seed() {
  await db.insert(roles).values(ROLE_DEFINITIONS).onConflictDoNothing({ target: roles.name });

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
    if (!roleId) throw new Error(`Role not found in DB: ${roleName}`);
    if (!permissionId) throw new Error(`Permission not found in DB: ${permissionName}`);
    return { roleId, permissionId };
  });

  await db.insert(role_permissions).values(rolePermissionRows).onConflictDoNothing();

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
