import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { authController } from './auth.controller.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', authController.register);
  app.post('/login', authController.login);
  app.post('/refresh', authController.refresh);
  app.post('/logout', authController.logout);
  app.post('/claim-guest', { preHandler: [requireAuth] }, authController.claimGuest);

  // Apple Watch pairing (device-code flow)
  app.post('/watch/pair/start', authController.pairStart);
  app.post('/watch/pair/poll', authController.pairPoll);
  app.post('/watch/pair/claim', { preHandler: [requireAuth] }, authController.pairClaim);
}
