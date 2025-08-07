import { ManagementClient } from 'auth0';

import env from '@/env';

const management = new ManagementClient({
  domain: env.AUTH0_DOMAIN,
  clientId: env.AUTH0_M2M_CLIENT_ID,
  clientSecret: env.AUTH0_M2M_CLIENT_SECRET,
});

export default management;
