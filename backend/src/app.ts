import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { AppError } from './common/errors/AppError.js';
import { allowedOriginsFromEnv } from './config/env.js';
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
import { followsRoutes } from './modules/follows/follows.routes.js';
import { coursesRoutes } from './modules/courses/courses.routes.js';
import { roundsRoutes } from './modules/rounds/rounds.routes.js';

export const buildApp = () => {
  const app = Fastify({ logger: true });

  // Dev-origins (alltid tillåtna) + ev. CORS_ORIGINS från env för produktion.
  const devOrigins = [
    'http://localhost:19006', // Expo web default
    'http://localhost:8081', // Alternative dev ports
    'http://localhost:8082',
    'http://localhost:3001', // Admin web default dev port
    'http://127.0.0.1:3001',
    'http://localhost:3002', // Webbapp dev port
    'http://127.0.0.1:3002'
  ];

  // Stöd för wildcard-mönster — t.ex. "https://*.vercel.app" matchar alla preview-deploys.
  const envPatterns = allowedOriginsFromEnv();
  const allowedExact = new Set<string>([...devOrigins, ...envPatterns.filter((o) => !o.includes('*'))]);
  const allowedWildcards = envPatterns
    .filter((o) => o.includes('*'))
    .map((o) => new RegExp('^' + o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));

  void app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedExact.has(origin)) {
        cb(null, true);
        return;
      }
      if (allowedWildcards.some((re) => re.test(origin))) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    credentials: true
  });

  // Healthcheck — Render pingar denna med jämna mellanrum för att hålla servern vaken
  // och för cold-start-detection.
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

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
  app.register(followsRoutes, { prefix: '/api/v1/follows' });
  app.register(coursesRoutes, { prefix: '/api/v1/courses' });
  app.register(roundsRoutes, { prefix: '/api/v1/rounds' });

  app.setErrorHandler((err, request, reply) => {
    request.log.error(
      { err, url: request.url, method: request.method, body: request.body, params: request.params },
      'request_failed'
    );

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

    // Prisma-specifika fel — översätt till begripliga 4xx där möjligt
    const e = err as { code?: string; message?: string };
    if (e?.code === 'P2002') {
      return reply.status(409).send({
        error: { code: 'CONFLICT', message: 'Resource already exists' }
      });
    }
    if (e?.code === 'P2003') {
      return reply.status(400).send({
        error: { code: 'FOREIGN_KEY_VIOLATION', message: 'Referenced record does not exist' }
      });
    }
    if (e?.code === 'P2025') {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Record not found' }
      });
    }

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'Unexpected error' : err.message || 'Unexpected error'
      }
    });
  });

  return app;
};
