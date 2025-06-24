import { Context } from 'hono';
import { Get, baseRoute } from '@/decorators/route.decorator';

@baseRoute('/api')
export class ProtectedController {
  @Get({
    path: '/protected',
    tags: ['Protected'],
    responses: {
      200: {
        description: 'Authenticated user data',
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      },
    },
  })
  async getProtectedData(ctx: Context) {
    const user = ctx.get('jwtPayload');
    
    return ctx.json({
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
    });
  }

  @Get({
    path: '/public',
    tags: ['Public'],
    responses: {
      200: {
        description: 'Public data available to everyone',
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      },
    },
  })
  async getPublicData(ctx: Context) {
    return ctx.json({
      message: '🌍 This is public data - no authentication required!',
      timestamp: new Date().toISOString(),
      data: {
        publicInfo: 'This is available to everyone',
        version: '1.0.0',
        features: ['basic-feature1', 'basic-feature2'],
      },
    });
  }
}