import { PrismaClient } from '@prisma/client';

/**
 * Stash the Prisma instance on globalThis in dev so tsx-watch / HMR
 * reloads don't spawn a brand-new client (each with its own connection
 * pool) every time a file changes. In production we get exactly one
 * client per process as expected.
 *
 * Without this, after ~10 reloads in dev you hit PgBouncer's
 * max-clients-in-session-mode (15) and queries start failing with
 * EMAXCONNSESSION.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
