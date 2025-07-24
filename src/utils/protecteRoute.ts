import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { logger } from '@/lib/logger';
import { server } from '@/server/server';
import { auth0Middleware } from '@/middlewares/auth0';
import type { Context } from 'hono';

const authErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

type ProtectedHandler = (c: Context, next?: () => Promise<void>) => Promise<Response>;

interface RouteConfig {
  tags: string[];
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  request?: any;
  responses: Record<number, any>;
  summary: string;
  description: string;
}

export const createProtectedRoute = (routeConfig: RouteConfig, handler: ProtectedHandler) => {
  const route = createRoute({
    ...routeConfig,
    responses: {
      ...routeConfig.responses,
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        authErrorSchema,
        'Unauthorized - Authentication required'
      ),
    },
  });

  const protectedHandler = async (c: Context, next?: () => Promise<void>) => {
    try {
      await auth0Middleware(c, async () => {});
      
      const user = c.get('jwtPayload');
      if (!user) {
        logger.warn('Authentication required - no JWT payload found');
        return c.json(
          {
            error: 'Authentication required',
            details: 'Valid JWT token required'
          },
          HttpStatusCodes.UNAUTHORIZED
        );
      }

      logger.info('User authenticated', { 
        userId: user.sub || user.id,
        email: user.email 
      });

      return await handler(c, next);
    } catch (error) {
      logger.error('Authentication error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: c.req.path,
        method: c.req.method
      });
      
      return c.json(
        {
          error: 'Authentication failed',
          details: 'Invalid or expired token'
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }
  };

  // Register the protected route
  server.openapi(route, protectedHandler as any);
  
  return route;
};