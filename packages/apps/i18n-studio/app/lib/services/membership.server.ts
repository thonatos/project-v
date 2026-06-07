import { eq, and, count } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { memberships, namespaces, users } from '~/db/schema';
import type { Membership, Role } from '~/db/schema';

export interface MemberView extends Membership {
  email: string;
  displayName: string | null;
}

export function listMembers(namespaceId: string): MemberView[] {
  const db = getDb();
  const rows = db
    .select({ m: memberships, email: users.email, displayName: users.displayName })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.namespaceId, namespaceId))
    .all();
  return rows.map((r) => ({ ...r.m, email: r.email, displayName: r.displayName }));
}

export function getRole(namespaceId: string, userId: string): Role | null {
  const db = getDb();
  const m = db
    .select()
    .from(memberships)
    .where(and(eq(memberships.namespaceId, namespaceId), eq(memberships.userId, userId)))
    .get();
  return m?.role ?? null;
}

export function inviteByEmail(namespaceId: string, email: string, role: Role): Membership {
  const db = getDb();
  const targetUser = db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).get();
  if (!targetUser) {
    throw new Error('用户不存在,请先让其注册');
  }
  const existing = db
    .select()
    .from(memberships)
    .where(and(eq(memberships.namespaceId, namespaceId), eq(memberships.userId, targetUser.id)))
    .get();
  if (existing) {
    throw new Error('用户已是成员,请使用 PATCH 更新角色');
  }
  const id = newId();
  const now = nowMs();
  const inserted: Membership = {
    id,
    namespaceId,
    userId: targetUser.id,
    role,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(memberships).values(inserted).run();
  return inserted;
}

export function updateRole(namespaceId: string, userId: string, nextRole: Role): Membership {
  const db = getDb();
  return db.transaction((tx) => {
    const current = tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.namespaceId, namespaceId), eq(memberships.userId, userId)))
      .get();
    if (!current) throw new Error('成员不存在');
    if (current.role === 'admin' && nextRole !== 'admin') {
      const adminCount =
        tx
          .select({ c: count() })
          .from(memberships)
          .where(and(eq(memberships.namespaceId, namespaceId), eq(memberships.role, 'admin')))
          .get()?.c ?? 0;
      if (adminCount <= 1) {
        throw new Error('命名空间必须保留至少 1 名管理员');
      }
    }
    tx.update(memberships).set({ role: nextRole, updatedAt: nowMs() }).where(eq(memberships.id, current.id)).run();
    return { ...current, role: nextRole, updatedAt: nowMs() };
  });
}

export function removeMember(namespaceId: string, userId: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const current = tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.namespaceId, namespaceId), eq(memberships.userId, userId)))
      .get();
    if (!current) return;
    if (current.role === 'admin') {
      const adminCount =
        tx
          .select({ c: count() })
          .from(memberships)
          .where(and(eq(memberships.namespaceId, namespaceId), eq(memberships.role, 'admin')))
          .get()?.c ?? 0;
      if (adminCount <= 1) {
        throw new Error('命名空间必须保留至少 1 名管理员');
      }
    }
    tx.delete(memberships).where(eq(memberships.id, current.id)).run();
  });
}

// 用于 API token 校验的辅助:确认 namespaceId 存在
export function namespaceExists(namespaceId: string): boolean {
  const db = getDb();
  return !!db.select().from(namespaces).where(eq(namespaces.id, namespaceId)).get();
}
