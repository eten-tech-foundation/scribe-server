import "reflect-metadata";

import { TaskController } from "@/controllers/task.controller";
import { IocContainer } from "@/ioc/container";
import configureOpenAPI from "@/lib/configure-open-api";
import { Server } from "@/server/server";
// Setup index route
import "@/routes/index.route";

// Initialize the IoC container
const container = IocContainer.container;

// Get server instance
const server = container.get(Server);

// Configure OpenAPI
configureOpenAPI(server.hono);

const taskController = container.get(TaskController);
taskController.setup();

export default server.hono;
