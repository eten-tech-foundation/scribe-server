import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';

import { auth0Middleware } from '@/middlewares/auth0';
import { logger } from '@/lib/logger';
import { server } from '@/server/server';

// Schema for protected endpoint response
const protectedDataSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
  user: z.object({
    id: z.string().optional(),
    email: z.string().optional(),
    name: z.string().optional(),
  }),
  data: z.object({
    secretCode: z.string(),
    level: z.string(),
    features: z.array(z.string()),
  }),
});

// Schema for public endpoint response
const publicDataSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
  data: z.object({
    publicInfo: z.string(),
    version: z.string(),
    features: z.array(z.string()),
  }),
});

// Protected endpoint that requires authentication
const protectedDataRoute = createRoute({
  tags: ['Protected'],
  method: 'get',
  path: '/api/protected',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      protectedDataSchema,
      'Authenticated user data'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        error: z.string(),
        details: z.string().optional(),
      }),
      'Unauthorized'
    ),
  },
  summary: 'Get protected data',
  description: 'Returns protected data for authenticated users',
});

// Apply Auth0 middleware and register the protected route
server.use('/api/protected', auth0Middleware);
server.openapi(protectedDataRoute, async (c) => {
  const user = c.get('jwtPayload');
  
  logger.info('Protected endpoint accessed', { userId: user?.sub });
  
  return c.json({
    message: '🔒 This is protected data - you are authenticated!',
    timestamp: new Date().toISOString(),
    user: {
      id: user?.sub,
      email: user?.email,
      name: user?.name,
    },
    data: {
      secretCode: 'ABC123XYZ',
      level: 'premium',
      features: ['feature1', 'feature2', 'feature3'],
    },
  }, HttpStatusCodes.OK);
});

// Public endpoint (no authentication required)
const publicDataRoute = createRoute({
  tags: ['Public'],
  method: 'get',
  path: '/api/public',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      publicDataSchema,
      'Public data available to everyone'
    ),
  },
  summary: 'Get public data',
  description: 'Returns public data that anyone can access',
});

server.openapi(publicDataRoute, async (c) => {
  logger.info('Public endpoint accessed');
  
  return c.json({
    message: '🌍 This is public data - no authentication required!',
    timestamp: new Date().toISOString(),
    data: {
      publicInfo: 'This is available to everyone',
      version: '1.0.0',
      features: ['basic-feature1', 'basic-feature2'],
    },
  }, HttpStatusCodes.OK);
}); 