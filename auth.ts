// NextAuth.js v5 (Auth.js) config.
// Magic-link via Resend. In dev (RESEND_API_KEY empty) prints links to console.

import NextAuth, { type DefaultSession } from 'next-auth';
import Resend from 'next-auth/providers/resend';
import Google from 'next-auth/providers/google';
import { Resend as ResendClient } from 'resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { createUser, getUserByEmail } from './lib/store';
import { isDbSkipped, prisma } from './lib/db';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      credits: number;
      ageVerifiedAt: Date | null;
    } & DefaultSession['user'];
  }
}

const PRINT_LINKS = process.env.AUTH_DEV_PRINT_LINKS === 'true' || !process.env.RESEND_API_KEY;
const GOOGLE_CONFIGURED =
  !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  // Prisma adapter is required for Email/Resend provider (stores VerificationTokens).
  // In SKIP_DB mode (local dev) we omit it and rely on JWT-only session.
  adapter: isDbSkipped ? undefined : PrismaAdapter(prisma),
  session: { strategy: 'jwt' }, // JWT session works with adapter
  secret: process.env.AUTH_SECRET,

  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? 'mock',
      from: process.env.AUTH_EMAIL_FROM ?? 'login@local.dev',
      async sendVerificationRequest({ identifier, url }) {
        // DEBUG: also stash the URL on the user row (image field, unused) so
        // we can pull it from /api/debug/db when email delivery is delayed.
        // Remove this block before public launch.
        if (!isDbSkipped && process.env.DEBUG_MAGIC_LINK === 'true') {
          try {
            await prisma.user.upsert({
              where: { email: identifier },
              update: { image: url },
              create: { email: identifier, image: url, credits: 0 },
            });
          } catch {/* ignore */}
        }

        if (PRINT_LINKS) {
          console.log('\n========================================');
          console.log('  MAGIC LINK for', identifier);
          console.log(' ', url);
          console.log('========================================\n');
          return;
        }
        const resend = new ResendClient(process.env.RESEND_API_KEY!);
        const { error } = await resend.emails.send({
          from: process.env.AUTH_EMAIL_FROM!,
          to: identifier,
          subject: '登录 MyHim Studio',
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:32px;color:#111;">
              <h2 style="margin:0 0 12px;">登录 MyHim Studio</h2>
              <p style="color:#555;margin:0 0 24px;">点击下方按钮完成登录。链接 24 小时内有效。</p>
              <a href="${url}" style="display:inline-block;padding:12px 22px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">登录</a>
              <p style="color:#999;font-size:12px;margin:32px 0 0;">若按钮无法点击，请复制此链接到浏览器：<br/>${url}</p>
            </div>
          `,
        });
        if (error) throw new Error(error.message);
      },
    }),
    // Google OAuth — enabled only when both env vars are set.
    // Without these env vars the provider isn't registered, so /api/auth/signin
    // won't list Google. We rely on JWT session strategy so Google login
    // works on the same session as Resend magic-links.
    ...(GOOGLE_CONFIGURED
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user }) {
      // Auto-create user on first sign-in
      if (user.email) {
        const existing = await getUserByEmail(user.email);
        if (!existing) {
          await createUser({ email: user.email, name: user.name ?? undefined });
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      // On sign-in, copy user.id into the token
      if (user?.email) {
        const dbUser = await getUserByEmail(user.email);
        if (dbUser) token.userId = dbUser.id;
      }
      return token;
    },

    async session({ session, token }) {
      const userId = (token.userId as string | undefined) ?? null;
      if (!userId) return session;
      const dbUser = await getUserByEmail(session.user.email);
      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.credits = dbUser.credits;
        session.user.ageVerifiedAt = dbUser.ageVerifiedAt;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    verifyRequest: '/login?sent=true',
  },
});

export { isDbSkipped };
