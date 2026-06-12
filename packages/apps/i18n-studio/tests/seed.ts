/**
 * Seed:创建初始用户 + 一个 docs 命名空间 + 几条示例词条
 * 用法:DATABASE_FILE=./data/i18n.db pnpm -F i18n-studio tsx tests/seed.ts
 *
 * 注:使用 npx tsx 或在 dev 启动后通过 UI 注册即可,这里仅是脚本骨架。
 */
import { registerUser } from '~/lib/auth.server';
import { createNamespace } from '~/lib/services/namespace.server';
import { upsertEntry } from '~/lib/services/entry.server';
import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { entries, namespaces, releaseItems, releases, translationVersions, translations } from '~/db/schema';
import { and, eq, sql } from 'drizzle-orm';

function seedReleaseManifest(namespaceId: string, actorId: string) {
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.id, namespaceId)).get();
  if (!ns) throw new Error('namespace not found');
  const now = nowMs();
  const releaseId = newId();
  db.transaction((tx) => {
    tx.insert(releases)
      .values({
        id: releaseId,
        namespaceId,
        bundleVersion: ns.bundleVersion,
        status: 'published',
        source: 'migration',
        note: 'Seeded sample release manifest.',
        createdBy: actorId,
        createdAt: now,
        publishedAt: now,
      })
      .run();

    const rows = tx
      .select({
        entryId: entries.id,
        key: entries.key,
        locale: translations.locale,
        translationVersionId: translationVersions.id,
        translationVersionNumber: translationVersions.version,
        value: translationVersions.value,
      })
      .from(translations)
      .innerJoin(entries, eq(entries.id, translations.entryId))
      .innerJoin(
        translationVersions,
        and(
          eq(translationVersions.entryId, translations.entryId),
          eq(translationVersions.locale, translations.locale),
          eq(translationVersions.version, translations.publishedVersion),
        ),
      )
      .where(and(eq(entries.namespaceId, namespaceId), sql`${translations.publishedVersion} IS NOT NULL`))
      .all();

    for (const row of rows) {
      tx.insert(releaseItems)
        .values({
          id: newId(),
          releaseId,
          entryId: row.entryId,
          locale: row.locale,
          key: row.key,
          value: row.value,
          translationVersionId: row.translationVersionId,
          translationVersionNumber: row.translationVersionNumber,
        })
        .run();
    }
    console.log('release manifest seeded:', ns.bundleVersion, 'items:', rows.length);
  });
}

async function main() {
  const email = process.env.SEED_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_PASSWORD ?? 'changeme123';

  let user;
  try {
    user = await registerUser(email, password, 'Admin');
  } catch (e) {
    console.log('user exists, skipping register:', (e as Error).message);
    return;
  }

  const ns = createNamespace({
    slug: 'docs',
    name: 'Documentation',
    createdBy: user.id,
  });
  console.log('namespace created:', ns.slug);

  upsertEntry({
    namespaceId: ns.id,
    key: 'home.title',
    translations: { 'zh-cn': '首页', 'zh-tw': '首頁', 'en-us': 'Home' },
    actorId: user.id,
  });
  upsertEntry({
    namespaceId: ns.id,
    key: 'home.cta.primary',
    translations: { 'zh-cn': '立即开始', 'zh-tw': '立即開始', 'en-us': 'Get started' },
    actorId: user.id,
  });
  seedReleaseManifest(ns.id, user.id);

  console.log('seed done.  email:', email, 'password:', password);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
