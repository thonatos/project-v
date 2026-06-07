import { createCookieSessionStorage, redirect } from 'react-router';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { users, namespaces, memberships } from '~/db/schema';
import type { User, Role, Namespace } from '~/db/schema';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__i18n_studio_session',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === 'production',
  },
});

const USER_KEY = 'userId';

export async function getUserId(request: Request): Promise<string | null> {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const userId = session.get(USER_KEY);
  return typeof userId === 'string' ? userId : null;
}

export async function getUser(request: Request): Promise<User | null> {
  const userId = await getUserId(request);
  if (!userId) return null;
  const db = getDb();
  const found = db.select().from(users).where(eq(users.id, userId)).get();
  return found ?? null;
}

export async function requireUser(request: Request): Promise<User> {
  const user = await getUser(request);
  if (!user) {
    throw redirect('/login');
  }
  return user;
}

export async function loginAndCreateSession(userId: string, redirectTo = '/'): Promise<Response> {
  const session = await sessionStorage.getSession();
  session.set(USER_KEY, userId);
  return redirect(redirectTo, {
    headers: { 'Set-Cookie': await sessionStorage.commitSession(session) },
  });
}

export async function logout(request: Request, redirectTo = '/login'): Promise<Response> {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  return redirect(redirectTo, {
    headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
  });
}

export async function loginWithPassword(email: string, password: string): Promise<User | null> {
  const db = getDb();
  const user = db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).get();
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

export async function registerUser(email: string, password: string, displayName?: string): Promise<User> {
  const db = getDb();
  const trimmed = email.toLowerCase().trim();
  const existing = db.select().from(users).where(eq(users.email, trimmed)).get();
  if (existing) {
    throw new Error('该邮箱已注册');
  }
  // 首位用户自动 superuser
  const userCount = db.select({ id: users.id }).from(users).all().length;
  const passwordHash = await bcrypt.hash(password, 10);
  const id = newId();
  const now = nowMs();
  const inserted: User = {
    id,
    email: trimmed,
    passwordHash,
    displayName: displayName ?? null,
    isSuperuser: userCount === 0,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(users).values(inserted).run();
  return inserted;
}

export interface RoleContext {
  user: User;
  namespace: Namespace;
  role: Role;
}

export async function requireRole(request: Request, slug: string, allowedRoles: readonly Role[]): Promise<RoleContext> {
  const user = await requireUser(request);
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.slug, slug)).get();
  // 不暴露存在性差异:非成员一律 404
  if (!ns) {
    throw new Response('Not Found', { status: 404 });
  }
  const m = db
    .select()
    .from(memberships)
    .where(eq(memberships.namespaceId, ns.id))
    .all()
    .find((row) => row.userId === user.id);
  if (!m) {
    throw new Response('Not Found', { status: 404 });
  }
  if (!allowedRoles.includes(m.role)) {
    throw new Response('Forbidden', { status: 403 });
  }
  return { user, namespace: ns, role: m.role };
}

export async function getRole(request: Request, slug: string): Promise<RoleContext | null> {
  const user = await getUser(request);
  if (!user) return null;
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.slug, slug)).get();
  if (!ns) return null;
  const m = db
    .select()
    .from(memberships)
    .where(eq(memberships.namespaceId, ns.id))
    .all()
    .find((row) => row.userId === user.id);
  if (!m) return null;
  return { user, namespace: ns, role: m.role };
}
