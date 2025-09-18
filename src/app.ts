import configureOpenAPI from '@/lib/configure-open-api';
import { server } from '@/server/server';
import '@/routes/index.route';
import '@/routes/health.route';
import '@/routes/protected.route';
import '@/domains/users/users.route';
import '@/domains/users/chapter-assignments/users-chapter-assignments.route';
import '@/domains/projects/projects.route';
import '@/domains/projects/chapter-assignments/project-chapter-assignments.route';
// These chapter assignments routes are not in use as of 2025-09-18
// import '@/domains/chapter-assignments/chapter-assignments.route';
import '@/domains/languages/languages.route';
import '@/domains/bibles/bibles.route';
import '@/domains/books/books.route';
import '@/domains/bible-books/bible-books.route';
import '@/domains/projects/books/project-books.route';
configureOpenAPI(server);

export default server;
