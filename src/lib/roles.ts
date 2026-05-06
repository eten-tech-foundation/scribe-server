export const ORG_ROLES = {
  ORG_OWNER: 'org_owner',
  ORG_MANAGER: 'org_manager',
  MEMBER: 'member',
} as const;

export const PROJECT_ROLES = {
  PROJECT_MANAGER: 'project_manager',
  TRANSLATOR: 'translator',
  PEER_CHECKER: 'peer_checker',
  OBSERVER: 'observer',
} as const;

export type OrgRoleName = (typeof ORG_ROLES)[keyof typeof ORG_ROLES];
export type ProjectRoleName = (typeof PROJECT_ROLES)[keyof typeof PROJECT_ROLES];

// Keep ROLES as a backwards-compatibility alias during migration — remove after all callers updated
/** @deprecated Use ORG_ROLES or PROJECT_ROLES */
export const ROLES = {
  PROJECT_MANAGER: 'Manager',
  TRANSLATOR: 'Translator',
} as const;

/** @deprecated */
export type RoleName = (typeof ROLES)[keyof typeof ROLES];
