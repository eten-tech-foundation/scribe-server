export const ROLES = {
  PROJECT_MANAGER: 'Manager',
  TRANSLATOR: 'Translator',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
