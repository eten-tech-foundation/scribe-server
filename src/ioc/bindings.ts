import type { Container } from "inversify";

// Controllers
import { TaskController } from "@/controllers/task.controller";
// Server
import { Server } from "@/server/server";
// Services
import { ConfigService } from "@/services/config.service";
import { DatabaseService } from "@/services/database.service";
import { LoggerService } from "@/services/logger.service";
import { TaskService } from "@/services/task.service";

export function bindToContainers(container: Container): void {
  // Bind server
  container.bind(Server).toSelf().inSingletonScope();

  // Bind services
  container.bind(ConfigService).toSelf().inSingletonScope();
  container.bind(DatabaseService).toSelf().inSingletonScope();
  container.bind(LoggerService).toSelf().inSingletonScope();
  container.bind(TaskService).toSelf().inRequestScope();

  // Bind controllers
  container.bind(TaskController).toSelf().inRequestScope();
}
