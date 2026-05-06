import type { ChapterAssignmentWithAuthContext } from '@/domains/chapter-assignments/chapter-assignments.repository';
import type { OrgMembership } from '@/domains/orgs/org-memberships.types';
import type { ProjectWithLanguageNames } from '@/domains/projects/projects.types';
import type { TranslatedVerseResponse } from '@/domains/translated-verses/translated-verses.types';
import type { UserResponse } from '@/domains/users/users.types';
import type { AppBindings } from '@/lib/types';

export interface AppEnv extends AppBindings {
  Variables: AppBindings['Variables'] & {
    chapterAssignment?: ChapterAssignmentWithAuthContext;
    project?: ProjectWithLanguageNames;
    projectAuthContext?: { isProjectMember: boolean; projectRoles: string[] };
    targetUser?: UserResponse;
    translatedVerse?: TranslatedVerseResponse;
    orgMembership?: OrgMembership;
  };
}
