import * as repo from './project-books.repository';

export function getBooksByProjectId(projectId: number) {
  return repo.getBooksByProjectId(projectId);
}
