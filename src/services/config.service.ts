import { injectable } from "inversify";

import env from "@/env";

@injectable()
export class ConfigService {
  /**
   * Get environment variables with type safety
   */
  public get<T>(key: keyof typeof env): T {
    const value = env[key];

    if (value === "true") {
      return true as T;
    }

    if (value === "false") {
      return false as T;
    }

    if (!Number.isNaN(Number(value)) && typeof value === "string" && value.trim() !== "") {
      return Number(value) as T;
    }

    return value as T;
  }

  /**
   * Get all environment configuration
   */
  public getEnv() {
    return env;
  }
}
