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

// releases (immutable published bundle manifests)
export const releases = sqliteTable(
  'releases',
  {
    id: text('id').primaryKey(),
    namespaceId: text('namespace_id')
      .notNull()
      .references(() => namespaces.id, { onDelete: 'cascade' }),
    bundleVersion: integer('bundle_version').notNull(),
    status: text('status', { enum: ['published', 'rolled_back'] })
      .notNull()
      .default('published'),
    source: text('source', { enum: ['publish', 'import', 'sync', 'revert', 'delete', 'migration'] }).notNull(),
    note: text('note'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    publishedAt: integer('published_at').notNull(),
  },
  (t) => ({
    nsBundleIdx: uniqueIndex('releases_ns_bundle_idx').on(t.namespaceId, t.bundleVersion),
    nsCreatedIdx: index('releases_ns_created_idx').on(t.namespaceId, t.createdAt),
  }),
);

// release_items (manifest pointer for each published entry/locale in a release)
export const releaseItems = sqliteTable(
  'release_items',
  {
    id: text('id').primaryKey(),
    releaseId: text('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    entryId: text('entry_id').notNull(),
    locale: text('locale').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    translationVersionId: text('translation_version_id').notNull(),
    translationVersionNumber: integer('translation_version_number').notNull(),
  },
  (t) => ({
    releaseEntryLocaleIdx: uniqueIndex('release_items_release_entry_locale_idx').on(t.releaseId, t.entryId, t.locale),
    releaseLocaleKeyIdx: index('release_items_release_locale_key_idx').on(t.releaseId, t.locale, t.key),
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
    targetLocale: text('target_locale'),
    key: text('key').notNull(),
    sourceValue: text('source_value').notNull(),
    status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed', 'done'] })
      .notNull()
      .default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    leasedBy: text('leased_by'),
    leaseExpiresAt: integer('lease_expires_at'),
    lastError: text('last_error'),
    completedAt: integer('completed_at'),
  },
  (t) => ({
    taskEntryLocaleIdx: uniqueIndex('task_items_task_entry_locale_idx').on(t.taskId, t.entryId, t.targetLocale),
    taskStatusIdx: index('task_items_task_status_idx').on(t.taskId, t.status),
    taskLocaleStatusIdx: index('task_items_task_locale_status_idx').on(t.taskId, t.targetLocale, t.status),
    taskLeaseIdx: index('task_items_lease_idx').on(t.leaseExpiresAt),
  }),
);

// translation_task_logs
export const translationTaskLogs = sqliteTable(
  'translation_task_logs',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => translationTasks.id, { onDelete: 'cascade' }),
    itemId: text('item_id').references(() => translationTaskItems.id, { onDelete: 'set null' }),
    event: text('event', {
      enum: ['create', 'claim', 'heartbeat', 'result', 'retry', 'fail', 'cancel', 'complete'],
    }).notNull(),
    workerId: text('worker_id'),
    actorId: text('actor_id'),
    message: text('message'),
    metadata: text('metadata'), // JSON
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    taskCreatedIdx: index('task_logs_task_created_idx').on(t.taskId, t.createdAt),
    itemCreatedIdx: index('task_logs_item_created_idx').on(t.itemId, t.createdAt),
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
    scope: text('scope', { enum: ['task', 'readonly', 'write'] }).notNull(),
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

// namespace_invitations
export const namespaceInvitations = sqliteTable(
  'namespace_invitations',
  {
    id: text('id').primaryKey(),
    namespaceId: text('namespace_id')
      .notNull()
      .references(() => namespaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role', { enum: ['admin', 'editor', 'viewer'] }).notNull(),
    tokenHash: text('token_hash').notNull(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'accepted', 'revoked', 'expired'] })
      .notNull()
      .default('pending'),
    expiresAt: integer('expires_at').notNull(),
    acceptedBy: text('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: integer('accepted_at'),
    revokedAt: integer('revoked_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    nsEmailStatusIdx: index('invitations_ns_email_status_idx').on(t.namespaceId, t.email, t.status),
    tokenHashIdx: uniqueIndex('invitations_token_hash_idx').on(t.tokenHash),
    expiresIdx: index('invitations_expires_idx').on(t.expiresAt),
  }),
);

// audit_events
export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    namespaceId: text('namespace_id').references(() => namespaces.id, { onDelete: 'set null' }),
    actorId: text('actor_id'),
    actorType: text('actor_type', { enum: ['user', 'api_token', 'system'] })
      .notNull()
      .default('user'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    requestId: text('request_id'),
    before: text('before'), // JSON
    after: text('after'), // JSON
    metadata: text('metadata'), // JSON
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    nsCreatedIdx: index('audit_events_ns_created_idx').on(t.namespaceId, t.createdAt),
    actorCreatedIdx: index('audit_events_actor_created_idx').on(t.actorType, t.actorId, t.createdAt),
    actionCreatedIdx: index('audit_events_action_created_idx').on(t.action, t.createdAt),
    resourceIdx: index('audit_events_resource_idx').on(t.resourceType, t.resourceId),
  }),
);

// quality_issues
export const qualityIssues = sqliteTable(
  'quality_issues',
  {
    id: text('id').primaryKey(),
    namespaceId: text('namespace_id')
      .notNull()
      .references(() => namespaces.id, { onDelete: 'cascade' }),
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    locale: text('locale').notNull(),
    sourceLocale: text('source_locale'),
    issueType: text('issue_type', {
      enum: [
        'missing_translation',
        'pending_draft',
        'source_stale',
        'placeholder_mismatch',
        'html_tag_mismatch',
        'icu_error',
        'length_risk',
      ],
    }).notNull(),
    severity: text('severity', { enum: ['info', 'warning', 'error'] })
      .notNull()
      .default('warning'),
    status: text('status', { enum: ['open', 'resolved', 'suppressed'] })
      .notNull()
      .default('open'),
    sourceVersion: integer('source_version'),
    targetVersion: integer('target_version'),
    ruleVersion: text('rule_version').notNull(),
    details: text('details'), // JSON
    suppressedBy: text('suppressed_by').references(() => users.id, { onDelete: 'set null' }),
    suppressedReason: text('suppressed_reason'),
    suppressedAt: integer('suppressed_at'),
    resolvedAt: integer('resolved_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    nsStatusTypeIdx: index('quality_issues_ns_status_type_idx').on(t.namespaceId, t.status, t.issueType),
    nsLocaleStatusIdx: index('quality_issues_ns_locale_status_idx').on(t.namespaceId, t.locale, t.status),
    entryLocaleTypeIdx: index('quality_issues_entry_locale_type_idx').on(t.entryId, t.locale, t.issueType),
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
export type Release = typeof releases.$inferSelect;
export type NewRelease = typeof releases.$inferInsert;
export type ReleaseItem = typeof releaseItems.$inferSelect;
export type TranslationTask = typeof translationTasks.$inferSelect;
export type TaskStatus = TranslationTask['status'];
export type TranslationTaskItem = typeof translationTaskItems.$inferSelect;
export type TranslationTaskLog = typeof translationTaskLogs.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type TokenScope = ApiToken['scope'];
export type NamespaceInvitation = typeof namespaceInvitations.$inferSelect;
export type InvitationStatus = NamespaceInvitation['status'];
export type AuditEvent = typeof auditEvents.$inferSelect;
export type QualityIssue = typeof qualityIssues.$inferSelect;
export type Locale = typeof locales.$inferSelect;
export type NewLocale = typeof locales.$inferInsert;

// Suppress unused import warning if no raw SQL constraints
export const _sql = sql;
