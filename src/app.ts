import configureOpenAPI from '@/lib/configure-open-api';
import { server } from '@/server/server';
import '@/routes/index.route';
import '@/routes/health.route';
import '@/routes/protected.route';
import '@/domains/users/users.route';
import '@/domains/projects/projects.route';
import '@/domains/languages/languages.route';
import '@/domains/bibles/bibles.route';
import '@/domains/books/books.route';
import '@/domains/bible-books/bible-books.route';

configureOpenAPI(server);

export default server;
