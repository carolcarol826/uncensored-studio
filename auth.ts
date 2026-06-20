// NextAuth.js v5 (Auth.js) config.
// Magic-link via Resend. In dev (RESEND_API_KEY empty) prints links to console.

import NextAuth, { type DefaultSession } from 'next-auth';
import Resend from 'next-auth/providers/resend';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { Resend as ResendClient } from 'resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { createUser, getUserByEmail, getUserByPhone, verifyPhoneCode, getUserByReferralCode, addCredits } from './lib/store';
import { verifyPassword } from './lib/password';
import { normalizeCnPhone, hashCode } from './lib/sms';
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
  debug: process.env.AUTH_DEBUG === 'true',
  // Prisma adapter is required for Email/Resend provider (stores VerificationTokens).
  // In SKIP_DB mode (local dev) we omit it and rely on JWT-only session.
  adapter: isDbSkipped ? undefined : PrismaAdapter(prisma),
  session: { strategy: 'jwt' }, // JWT session works with adapter
  secret: process.env.AUTH_SECRET,

  providers: [
    // Magic-link (Email) provider REQUIRES a database adapter to store
    // VerificationTokens. In SKIP_DB mock mode there's no adapter, so skip it
    // (it can't work there anyway) — password + Google login still function.
    ...(isDbSkipped
      ? []
      : [
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? 'mock',
      from: process.env.AUTH_EMAIL_FROM ?? 'login@local.dev',
      async sendVerificationRequest({ identifier, url }) {
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
        ]),
    // Email + password login. Users get a password via /api/auth/register
    // (new accounts) or by setting one in Settings (existing OAuth/magic-link
    // accounts). Works on the same JWT session as the other providers.
    Credentials({
      id: 'password',
      name: 'Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? '').toLowerCase().trim();
        const password = String(creds?.password ?? '');
        if (!email || !password) return null;
        const user = await getUserByEmail(email);
        if (!user || !user.password) return null;
        const ok = await verifyPassword(password, user.password);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
    // +86 phone SMS-code login. Code is requested via /api/auth/sms/send (Aliyun).
    // Phone-only accounts get a synthetic unique email so the email-centric
    // adapter + jwt/session callbacks keep working; the real identity is `phone`.
    Credentials({
      id: 'sms',
      name: 'SMS',
      credentials: {
        phone: { label: 'Phone', type: 'tel' },
        code: { label: 'Code', type: 'text' },
        ref: { label: 'Ref', type: 'text' }, // optional referral code on first signup
      },
      async authorize(creds) {
        const norm = normalizeCnPhone(String(creds?.phone ?? ''));
        const code = String(creds?.code ?? '').trim();
        if (!norm || !/^\d{6}$/.test(code)) return null;
        const ok = await verifyPhoneCode(norm.e164, hashCode(norm.e164, code));
        if (!ok) return null;
        let user = await getUserByPhone(norm.e164);
        if (!user) {
          // First-time SMS login = signup; honor referral code if present.
          const refCode = String(creds?.ref ?? '').trim().toUpperCase();
          const referrer = refCode ? await getUserByReferralCode(refCode) : null;
          user = await createUser({
            email: `${norm.national}@phone.myhim.love`,
            name: norm.e164,
            phone: norm.e164,
            referredById: referrer?.id,
          });
          if (referrer && referrer.id !== user.id) {
            const rb = Number(process.env.REFERRAL_REFERRER_BONUS ?? '50');
            const sb = Number(process.env.REFERRAL_SIGNUP_BONUS ?? '50');
            try {
              await Promise.all([
                addCredits(referrer.id, rb, 'ADMIN_ADJUST', user.id, `referral: ${user.email}`),
                addCredits(user.id, sb, 'ADMIN_ADJUST', referrer.id, 'referred-by bonus'),
              ]);
            } catch { /* non-fatal */ }
          }
        }
        return { id: user.id, email: user.email, name: user.name ?? undefined };
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

  // events run AFTER the adapter has created the row, so we don't race with
  // PrismaAdapter trying to create the same user from an OAuth callback.
  events: {
    async createUser({ user }) {
      console.log('[auth.events.createUser]', { id: user.id, email: user.email });
      if (isDbSkipped || !user.id) return;
      try {
        const existing = await prisma.creditTx.findFirst({
          where: { userId: user.id, kind: 'SIGNUP_BONUS' },
        });
        if (existing) return;
        await prisma.creditTx.create({
          data: {
            userId: user.id,
            kind: 'SIGNUP_BONUS',
            delta: 20,
            balanceAfter: 20,
            note: 'Welcome bonus',
          },
        });
      } catch (err: any) {
        console.error('[auth.events.createUser] bonus failed', err?.message);
      }
    },
    async signIn({ user, account, isNewUser }) {
      console.log('[auth.events.signIn]', {
        email: user.email,
        provider: account?.provider,
        isNewUser,
      });
    },
    async linkAccount({ user, account }) {
      console.log('[auth.events.linkAccount]', {
        email: user.email,
        provider: account.provider,
        providerAccountId: account.providerAccountId?.slice(0, 8) + '...',
      });
    },
  },

  callbacks: {
    // In SKIP_DB (mock) mode there's no adapter, so we still need to
    // create the user manually. With a real adapter, return true and let
    // PrismaAdapter handle it (events.createUser awards the bonus).
    async signIn({ user }) {
      if (isDbSkipped && user.email) {
        const existing = await getUserByEmail(user.email);
        if (!existing) {
          await createUser({ email: user.email, name: user.name ?? undefined });
        }
      }
      return true;
    },

    async jwt({ token, user, account, profile }) {
      try {
        // On sign-in, copy user.id into the token
        if (user?.email) {
          const dbUser = await getUserByEmail(user.email);
          if (dbUser) token.userId = dbUser.id;
          else {
            console.error('[auth.jwt] user.email present but no DB user found', {
              email: user.email,
              account: account?.provider,
              profile: !!profile,
            });
          }
        }
        return token;
      } catch (err: any) {
        console.error('[auth.jwt] failed', err?.message, err?.code, err?.stack?.split('\n').slice(0, 5).join(' | '));
        // Don't throw — surfacing here as Configuration error blocks login.
        return token;
      }
    },

    async session({ session, token }) {
      try {
        const userId = (token.userId as string | undefined) ?? null;
        if (!userId) return session;
        const dbUser = await getUserByEmail(session.user.email);
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.credits = dbUser.credits;
          session.user.ageVerifiedAt = dbUser.ageVerifiedAt;
        }
        return session;
      } catch (err: any) {
        console.error('[auth.session] failed', err?.message, err?.code);
        return session;
      }
    },
  },

  pages: {
    signIn: '/login',
    verifyRequest: '/login?sent=true',
  },
});

export { isDbSkipped };
