// Storage abstraction: works in two modes.
//   SKIP_DB=true  → in-memory (dev only, resets on restart)
//   SKIP_DB=false → Prisma + Postgres (production)
//
// Use these functions everywhere instead of touching `prisma` directly,
// so the same code works in mock and real modes.

import { isDbSkipped, prisma } from './db';
import type {
  CreditTxKind,
  GenerationKind,
  GenerationStatus,
} from '@prisma/client';

// --------------- Mock-mode in-memory state ---------------

interface MockUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  ageVerifiedAt: Date | null;
  credits: number;
  totalSpent: number;
  createdAt: Date;
}

interface MockGeneration {
  id: string;
  userId: string;
  kind: GenerationKind;
  workflowId: string;
  checkpoint: string;
  prompt: string;
  negativePrompt: string | null;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: bigint;
  batchSize: number;
  numFrames: number | null;
  inputImageKey: string | null;
  costCredits: number;
  status: GenerationStatus;
  promptIdRemote: string | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
  outputs: { id: string; kind: string; key: string }[];
}

interface MockCreditTx {
  id: string;
  userId: string;
  kind: CreditTxKind;
  delta: number;
  balanceAfter: number;
  reference: string | null;
  note: string | null;
  createdAt: Date;
}

const mockUsers = new Map<string, MockUser>();
const mockUsersByEmail = new Map<string, string>(); // email → id
const mockGenerations = new Map<string, MockGeneration>();
const mockCreditTxs: MockCreditTx[] = [];

// Seed a default test user in mock mode for instant dev experience
function ensureMockSeed() {
  if (mockUsers.size > 0) return;
  const u: MockUser = {
    id: 'mock-user-1',
    email: 'demo@local.dev',
    name: 'Demo User',
    image: null,
    ageVerifiedAt: new Date(),
    credits: 1000,
    totalSpent: 0,
    createdAt: new Date(),
  };
  mockUsers.set(u.id, u);
  mockUsersByEmail.set(u.email, u.id);
}

function makeId(prefix = 'cm') {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// --------------- Public API ---------------

export type User = MockUser;

export async function getUserByEmail(email: string): Promise<User | null> {
  if (isDbSkipped) {
    ensureMockSeed();
    const id = mockUsersByEmail.get(email);
    return id ? mockUsers.get(id) ?? null : null;
  }
  const u = await prisma.user.findUnique({ where: { email } });
  return u as User | null;
}

export async function getUserById(id: string): Promise<User | null> {
  if (isDbSkipped) {
    ensureMockSeed();
    return mockUsers.get(id) ?? null;
  }
  const u = await prisma.user.findUnique({ where: { id } });
  return u as User | null;
}

export async function createUser(args: { email: string; name?: string }): Promise<User> {
  if (isDbSkipped) {
    ensureMockSeed();
    const id = makeId('u');
    const u: MockUser = {
      id,
      email: args.email,
      name: args.name ?? null,
      image: null,
      ageVerifiedAt: null,
      credits: 20,
      totalSpent: 0,
      createdAt: new Date(),
    };
    mockUsers.set(id, u);
    mockUsersByEmail.set(args.email, id);

    // signup bonus tx
    mockCreditTxs.push({
      id: makeId('ct'),
      userId: id,
      kind: 'SIGNUP_BONUS',
      delta: 20,
      balanceAfter: 20,
      reference: null,
      note: 'Welcome bonus',
      createdAt: new Date(),
    });
    return u;
  }

  return prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { email: args.email, name: args.name } });
    await tx.creditTx.create({
      data: {
        userId: u.id,
        kind: 'SIGNUP_BONUS',
        delta: 20,
        balanceAfter: 20,
        note: 'Welcome bonus',
      },
    });
    return u as User;
  });
}

export async function setAgeVerified(userId: string): Promise<void> {
  if (isDbSkipped) {
    const u = mockUsers.get(userId);
    if (u) u.ageVerifiedAt = new Date();
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { ageVerifiedAt: new Date() },
  });
}

// --------- Credits ---------

export async function addCredits(
  userId: string,
  delta: number,
  kind: CreditTxKind,
  ref?: string,
  note?: string
): Promise<number> {
  if (delta <= 0) throw new Error('addCredits requires positive delta');
  if (isDbSkipped) {
    const u = mockUsers.get(userId);
    if (!u) throw new Error('User not found');
    u.credits += delta;
    mockCreditTxs.push({
      id: makeId('ct'),
      userId,
      kind,
      delta,
      balanceAfter: u.credits,
      reference: ref ?? null,
      note: note ?? null,
      createdAt: new Date(),
    });
    return u.credits;
  }
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: delta } },
    });
    await tx.creditTx.create({
      data: {
        userId,
        kind,
        delta,
        balanceAfter: u.credits,
        reference: ref,
        note,
      },
    });
    return u.credits;
  });
}

/** Atomically deduct credits or throw if insufficient. Returns new balance. */
export async function deductCredits(
  userId: string,
  cost: number,
  ref?: string,
  note?: string
): Promise<number> {
  if (cost <= 0) throw new Error('deductCredits requires positive cost');
  if (isDbSkipped) {
    const u = mockUsers.get(userId);
    if (!u) throw new Error('User not found');
    if (u.credits < cost) throw new InsufficientCreditsError(u.credits, cost);
    u.credits -= cost;
    u.totalSpent += cost;
    mockCreditTxs.push({
      id: makeId('ct'),
      userId,
      kind: 'GENERATION',
      delta: -cost,
      balanceAfter: u.credits,
      reference: ref ?? null,
      note: note ?? null,
      createdAt: new Date(),
    });
    return u.credits;
  }
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId } });
    if (!u) throw new Error('User not found');
    if (u.credits < cost) throw new InsufficientCreditsError(u.credits, cost);
    const updated = await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: cost }, totalSpent: { increment: cost } },
    });
    await tx.creditTx.create({
      data: {
        userId,
        kind: 'GENERATION',
        delta: -cost,
        balanceAfter: updated.credits,
        reference: ref,
        note,
      },
    });
    return updated.credits;
  });
}

export class InsufficientCreditsError extends Error {
  constructor(public balance: number, public required: number) {
    super(`Insufficient credits: have ${balance}, need ${required}`);
    this.name = 'InsufficientCreditsError';
  }
}

export async function getCreditHistory(userId: string, limit = 50) {
  if (isDbSkipped) {
    return mockCreditTxs
      .filter((t) => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  return prisma.creditTx.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// --------- Generations ---------

export async function createGeneration(args: {
  userId: string;
  kind: GenerationKind;
  workflowId: string;
  checkpoint: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: bigint;
  batchSize?: number;
  numFrames?: number;
  inputImageKey?: string;
  costCredits: number;
  promptIdRemote?: string;
}) {
  if (isDbSkipped) {
    const id = makeId('g');
    const g: MockGeneration = {
      id,
      userId: args.userId,
      kind: args.kind,
      workflowId: args.workflowId,
      checkpoint: args.checkpoint,
      prompt: args.prompt,
      negativePrompt: args.negativePrompt ?? null,
      width: args.width,
      height: args.height,
      steps: args.steps,
      cfg: args.cfg,
      seed: args.seed,
      batchSize: args.batchSize ?? 1,
      numFrames: args.numFrames ?? null,
      inputImageKey: args.inputImageKey ?? null,
      costCredits: args.costCredits,
      status: 'PENDING',
      promptIdRemote: args.promptIdRemote ?? null,
      errorMessage: null,
      createdAt: new Date(),
      completedAt: null,
      outputs: [],
    };
    mockGenerations.set(id, g);
    return g;
  }
  return prisma.generation.create({ data: args });
}

export async function updateGenerationStatus(
  id: string,
  status: GenerationStatus,
  errorMessage?: string
) {
  if (isDbSkipped) {
    const g = mockGenerations.get(id);
    if (g) {
      g.status = status;
      if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELED') {
        g.completedAt = new Date();
      }
      if (errorMessage) g.errorMessage = errorMessage;
    }
    return;
  }
  await prisma.generation.update({
    where: { id },
    data: {
      status,
      errorMessage,
      completedAt:
        status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELED'
          ? new Date()
          : undefined,
    },
  });
}

export async function addOutputFile(args: {
  generationId: string;
  kind: 'image' | 'video';
  key: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}) {
  if (isDbSkipped) {
    const g = mockGenerations.get(args.generationId);
    if (g) {
      g.outputs.push({
        id: makeId('o'),
        kind: args.kind,
        key: args.key,
      });
    }
    return;
  }
  await prisma.outputFile.create({
    data: {
      generationId: args.generationId,
      kind: args.kind,
      key: args.key,
      width: args.width,
      height: args.height,
      sizeBytes: args.sizeBytes,
    },
  });
}

export async function listGenerations(userId: string, limit = 100) {
  if (isDbSkipped) {
    return Array.from(mockGenerations.values())
      .filter((g) => g.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  return prisma.generation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { outputs: true },
  });
}

// --------- Webhook idempotency ---------

const mockWebhookEvents = new Set<string>();

export async function rememberWebhook(
  id: string,
  provider: string,
  eventType: string,
  payload: string
): Promise<boolean> {
  // Returns true if event is new, false if already processed.
  if (isDbSkipped) {
    if (mockWebhookEvents.has(id)) return false;
    mockWebhookEvents.add(id);
    return true;
  }
  try {
    await prisma.webhookEvent.create({
      data: { id, provider, eventType, payload },
    });
    return true;
  } catch (err: any) {
    // Unique constraint = already processed
    if (err.code === 'P2002') return false;
    throw err;
  }
}
