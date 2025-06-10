import type { Logger } from "pino";

import { inject, injectable } from "inversify";
import { pino } from "pino";

import { ConfigService } from "./config.service";

@injectable()
export class LoggerService {
  private _logger: Logger;
  private configService: ConfigService;

  constructor(@inject(ConfigService) configService: ConfigService) {
    this.configService = configService;

    const isDev = this.configService.get("NODE_ENV") === "development" || this.configService.get("NODE_ENV") === "dev";

    if (isDev) {
      this._logger = pino({
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      });
    }
    else {
      this._logger = pino({
        level: "info",
      });
    }
  }

  get logger(): Logger {
    return this._logger;
  }

  info(message: string, ...args: any[]): void {
    this._logger.info(message, ...args);
  }

  error(message: string, error?: Error | any, ...args: any[]): void {
    this._logger.error(error || {}, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this._logger.warn(message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this._logger.debug(message, ...args);
  }
}
