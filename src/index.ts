import "reflect-metadata";
import { serve } from "@hono/node-server";

import app from "./app";
import { registerPendingRoutes } from "./decorators/route.decorator";
import { registerPendingMiddlewares } from "./decorators/middleware.decorator";
import env from "./env";

// Load all middlewares and routes
registerPendingMiddlewares();
registerPendingRoutes();

const port = env.PORT;
// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
