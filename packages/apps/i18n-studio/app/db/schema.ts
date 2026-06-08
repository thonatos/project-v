import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// users
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  isSuperuser: integer('is_superuser', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// namespaces
export const namespaces = sqliteTable(
  'namespaces',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    defaultLocale: text('default_locale').notNull().default('zh-cn'),
    locales: text('locales').notNull(), // JSON array
    publicRead: integer('public_read', { mode: 'boolean' }).notNull().default(false),
    bundleVersion: integer('bundle_version').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    createdBy: text('created_by').notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('namespaces_slug_idx').on(t.slug),
  }),
);

// memberships
export const memberships = sqliteTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    namespaceId: text('namespace_id')
      .notNull()
      .references(() => namespaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'editor', 'viewer'] }).notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    nsUserIdx: uniqueIndex('memberships_ns_user_idx').on(t.namespaceId, t.userId),
    userIdx: index('memberships_user_idx').on(t.userId),
  }),
);

// entries
export const entries = sqliteTable(
  'entries',
  {
    id: text('id').primaryKey(),
    namespaceId: text('namespace_id')
      .notNull()
      .references(() => namespaces.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    description: text('description'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    updatedBy: text('updated_by').notNull(),
  },
  (t) => ({
    nsKeyIdx: uniqueIndex('entries_ns_key_idx').on(t.namespaceId, t.key),
  }),
);

// translations  (current published cache)
export const translations = sqliteTable(
  'translations',
  {
    id: text('id').primaryKey(),
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    value: text('value').notNull(),
    publishedVersion: integer('published_version'), // null = no published yet
    updatedAt: integer('updated_at').notNull(),
    updatedBy: text('updated_by').notNull(),
  },
  (t) => ({
    entryLocaleIdx: uniqueIndex('translations_entry_locale_idx').on(t.entryId, t.locale),
  }),
);

// translation_versions  (append-only history)
export const translationVersions = sqliteTable(
  'translation_versions',
  {
    id: text('id').primaryKey(),
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    version: integer('version').notNull(),
    value: text('value').notNull(),
    source: text('source', {
      enum: ['manual', 'import', 'task', 'sync', 'revert'],
    }).notNull(),
    status: text('status', {
      enum: ['draft', 'published', 'discarded'],
    })
      .notNull()
      .default('draft'),
    actorId: text('actor_id').notNull(),
    metadata: text('metadata'), // JSON
    createdAt: integer('created_at').notNull(),
    publishedAt: integer('published_at'),
  },
  (t) => ({
    entryLocaleVersionIdx: uniqueIndex('tv_entry_locale_version_idx').on(t.entryId, t.locale, t.version),
    entryLocaleStatusIdx: index('tv_entry_locale_status_idx').on(t.entryId, t.locale, t.status),
  }),
);

// translation_tasks
export const translationTasks = sqliteTable(
  'translation_tasks',
  {
    id: text('id').primaryKey(),
    namespaceId: text('namespace_id')
      .notNull()
      .references(() => namespaces.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
    }).notNull(),
    targetLocales: text('target_locales').notNull(), // JSON array
    filter: text('filter').notNull(), // JSON
    sourceLocale: text('source_locale').notNull(),
    total: integer('total').notNull(),
    done: integer('done').notNull().default(0),
    createdBy: text('created_by').notNull(),
    workerId: text('worker_id'),
    startedAt: integer('started_at'),
    completedAt: integer('completed_at'),
    failedReason: text('failed_reason'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    nsStatusIdx: index('tasks_ns_status_idx').on(t.namespaceId, t.status, t.createdAt),
  }),
);

// translation_task_items
export const translationTaskItems = sqliteTable(
  'translation_task_items',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => translationTasks.id, { onDelete: 'cascade' }),
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    sourceValue: text('source_value').notNull(),
    status: text('status', { enum: ['pending', 'done'] })
      .notNull()
      .default('pending'),
  },
  (t) => ({
    taskEntryIdx: uniqueIndex('task_items_task_entry_idx').on(t.taskId, t.entryId),
    taskStatusIdx: index('task_items_task_status_idx').on(t.taskId, t.status),
  }),
);

// api_tokens
export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    namespaceId: text('namespace_id')
      .notNull()
      .references(() => namespaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    scope: text('scope', { enum: ['task', 'readonly'] }).notNull(),
    tokenHash: text('token_hash').notNull(),
    tokenPrefix: text('token_prefix').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (t) => ({
    nsScopeIdx: index('tokens_ns_scope_idx').on(t.namespaceId, t.scope),
  }),
);

// locales (system-wide language dictionary)
export const locales = sqliteTable(
  'locales',
  {
    code: text('code').primaryKey(),
    label: text('label').notNull(),
    englishLabel: text('english_label').notNull(),
    nativeLabel: text('native_label'),
    region: text('region'),
    isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    enabledSortIdx: index('locales_enabled_sort_idx').on(t.enabled, t.sortOrder),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Namespace = typeof namespaces.$inferSelect;
export type NewNamespace = typeof namespaces.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type Role = Membership['role'];
export type Entry = typeof entries.$inferSelect;
export type Translation = typeof translations.$inferSelect;
export type TranslationVersion = typeof translationVersions.$inferSelect;
export type TranslationStatus = TranslationVersion['status'];
export type TranslationSource = TranslationVersion['source'];
export type TranslationTask = typeof translationTasks.$inferSelect;
export type TaskStatus = TranslationTask['status'];
export type TranslationTaskItem = typeof translationTaskItems.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type TokenScope = ApiToken['scope'];
export type Locale = typeof locales.$inferSelect;
export type NewLocale = typeof locales.$inferInsert;

// Suppress unused import warning if no raw SQL constraints
export const _sql = sql;
