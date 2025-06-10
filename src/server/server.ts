import { OpenAPIHono } from "@hono/zod-openapi";
import { injectable } from "inversify";

import type { AppBindings } from "@/lib/types";

@injectable()
export class Server {
  private _hono = new OpenAPIHono<AppBindings>({
    strict: false,
  });

  get hono() {
    return this._hono;
  }
}
