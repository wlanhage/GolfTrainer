import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { pushController } from './push.controller.js';

export async function pushRoutes(app: FastifyInstance) {
  // Public — returns the VAPID public key needed by clients to create a PushSubscription.
  app.get('/vapid-public-key', pushController.getVapidPublicKey);

  // Protected routes
  app.post('/subscribe', { preHandler: requireAuth }, pushController.subscribe);
  app.delete('/subscribe', { preHandler: requireAuth }, pushController.unsubscribe);
}
