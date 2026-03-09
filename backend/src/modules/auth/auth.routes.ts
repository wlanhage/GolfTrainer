import { FastifyInstance } from 'fastify';
import { authController } from './auth.controller.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', authController.register);
  app.post('/login', authController.login);
  app.post('/refresh', authController.refresh);
  app.post('/logout', authController.logout);
}
