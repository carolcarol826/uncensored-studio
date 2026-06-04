#!/usr/bin/env node
// One-shot cleanup: any existing user.image rows that are NextAuth callback
// URLs got stashed there by the debug-mode hook. Wipe them.
//
// Run once via Vercel CLI:
//   vercel env pull --environment=production /tmp/prod.env
//   set -a; . /tmp/prod.env; set +a; node scripts/purge-debug-links.mjs
//   rm /tmp/prod.env

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const r = await prisma.user.updateMany({
  where: { image: { contains: '/api/auth/callback/' } },
  data: { image: null },
});
console.log('cleared image stash on', r.count, 'users');
await prisma.$disconnect();
