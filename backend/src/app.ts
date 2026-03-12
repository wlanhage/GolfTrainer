import Fastify from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './common/errors/AppError.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { clubsRoutes } from './modules/clubs/clubs.routes.js';
import { practiceSessionsRoutes } from './modules/practice-sessions/practiceSessions.routes.js';
import { drillsRoutes } from './modules/drills/drills.routes.js';
import { drillAttemptsRoutes } from './modules/drill-attempts/drillAttempts.routes.js';
import { shotsRoutes } from './modules/shots/shots.routes.js';
import { statsRoutes } from './modules/stats/stats.routes.js';
import { caddyRoutes } from './modules/caddy/caddy.routes.js';
import { missionsRoutes } from './modules/missions/missions.routes.js';

export const buildApp = () => {
  const app = Fastify({ logger: true });

  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(usersRoutes, { prefix: '/api/v1/users' });
  app.register(clubsRoutes, { prefix: '/api/v1/clubs' });
  app.register(practiceSessionsRoutes, { prefix: '/api/v1/practice-sessions' });
  app.register(drillsRoutes, { prefix: '/api/v1/drills' });
  app.register(drillAttemptsRoutes, { prefix: '/api/v1/drill-attempts' });
  app.register(shotsRoutes, { prefix: '/api/v1/shots' });
  app.register(statsRoutes, { prefix: '/api/v1/stats' });
  app.register(caddyRoutes, { prefix: '/api/v1/caddy' });
  app.register(missionsRoutes, { prefix: '/api/v1/missions' });

  app.setErrorHandler((err, request, reply) => {
    request.log.error({ err }, 'request_failed');

    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request input', details: err.flatten() }
      });
    }

    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message }
      });
    }

    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' }
    });
  });

  return app;
};
