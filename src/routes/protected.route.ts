import { createRoute } from '@/decorators/route.decorator';
import { auth0Middleware } from '@/middlewares/auth0';

createRoute('get', '/protected', [auth0Middleware], async (c) => {
  const user = c.get('jwtPayload');
  return c.json({
    message: 'You are authenticated!',
    user,
  });
}); 