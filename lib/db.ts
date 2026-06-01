import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const isDbSkipped = process.env.SKIP_DB === 'true';

function makePrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// Lazy / null when skipped — protects against connecting in mock mode.
export const prisma: PrismaClient = isDbSkipped
  ? (new Proxy(
      {},
      {
        get() {
          throw new Error(
            'Prisma client called but SKIP_DB=true. Use a mock store or set SKIP_DB=false.'
          );
        },
      }
    ) as unknown as PrismaClient)
  : (globalThis.__prisma ??= makePrisma());

if (process.env.NODE_ENV !== 'production' && !isDbSkipped) {
  globalThis.__prisma = prisma;
}
