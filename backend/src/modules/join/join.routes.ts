import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { joinController } from './join.controller.js';

/**
 * QR-join för rundor. GET-info och gäst-join är publika (koden i länken är
 * behörigheten); att skapa invites och joina som användare kräver inloggning.
 */
export async function joinRoutes(app: FastifyInstance) {
  app.post('/invites', { preHandler: [requireAuth] }, joinController.createInvite);
  app.get('/invites/:code', joinController.getInviteInfo);
  app.post('/invites/:code/join', { preHandler: [requireAuth] }, joinController.joinAsUser);
  app.post('/invites/:code/guest', joinController.joinAsGuest);
}
