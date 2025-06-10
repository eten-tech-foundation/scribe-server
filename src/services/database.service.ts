import { drizzle } from "drizzle-orm/postgres-js";
import { injectable } from "inversify";
import postgres from "postgres";

import * as schema from "@/db/schema";
import env from "@/env";

@injectable()
export class DatabaseService {
  private _db: ReturnType<typeof drizzle>;
  private _client: postgres.Sql;

  constructor() {
    this._client = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
    });

    this._db = drizzle(this._client, {
      schema,
    });
  }

  get db() {
    return this._db;
  }

  get client() {
    return this._client;
  }

  async close(): Promise<void> {
    await this._client.end();
  }
}
