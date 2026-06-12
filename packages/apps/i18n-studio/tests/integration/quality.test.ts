import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDbFromTemplate, bootstrap, seedWorld, type TestCtx } from '../helpers';

describe('quality workbench', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDbFromTemplate();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  it('runs deterministic rules for missing, draft, stale, placeholder, html, ICU and length risks', async () => {
    const w = await seedWorld(ctx);
    const { entry, quality } = ctx.api;
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'home.title',
      translations: {
        'zh-cn': 'Hello {name} <strong>today</strong>',
        'en-us': 'Hello <em>today</em>',
      },
      actorId: w.alice.id,
    });
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'home.title',
      translations: {
        'en-us':
          'Hello today with an intentionally long translation that keeps going far beyond the source string length.',
      },
      asDraft: true,
      actorId: w.alice.id,
    });
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'cart.count',
      translations: {
        'zh-cn': '{count, plural, one {1 item} other {{count} items}}',
        'en-us': '{count} items',
      },
      actorId: w.alice.id,
    });
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'legal.cta',
      translations: {
        'zh-cn': '确认继续下一步操作并保存',
        'en-us': 'Confirm that you want to continue after reading every detail in this unusually verbose button label.',
      },
      actorId: w.alice.id,
    });
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'home.title',
      translations: { 'zh-cn': 'Hello {name} <strong>right now</strong>' },
      actorId: w.alice.id,
    });

    const findings = quality.runQualityRules(w.docs.id);
    const types = findings.map((finding) => `${finding.key}:${finding.locale}:${finding.issueType}`);

    expect(types).toContain('home.title:zh-tw:missing_translation');
    expect(types).toContain('home.title:en-us:pending_draft');
    expect(types).toContain('home.title:en-us:source_stale');
    expect(types).toContain('home.title:en-us:placeholder_mismatch');
    expect(types).toContain('home.title:en-us:html_tag_mismatch');
    expect(types).toContain('cart.count:en-us:icu_error');
    expect(types.some((type) => type.endsWith(':length_risk'))).toBe(true);
  });

  it('scans issues, resolves fixed issues, suppresses with audit, and filters list results', async () => {
    const w = await seedWorld(ctx);
    const { entry, quality, audit } = ctx.api;
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'home.subtitle',
      translations: { 'zh-cn': '你好 {name}', 'en-us': 'Hello' },
      actorId: w.alice.id,
    });

    const firstScan = quality.scanQualityIssues(w.docs.id, w.alice.id);
    expect(firstScan.opened).toBeGreaterThan(0);
    const placeholderIssues = quality.listQualityIssues({
      namespaceId: w.docs.id,
      issueType: 'placeholder_mismatch',
      locale: 'en-us',
      prefix: 'home.',
      status: 'open',
    });
    expect(placeholderIssues).toHaveLength(1);

    const suppressed = quality.updateQualityIssueStatus(placeholderIssues[0]!.id, {
      status: 'suppressed',
      actorId: w.alice.id,
      reason: 'copy accepted',
      namespaceId: w.docs.id,
    });
    expect(suppressed.status).toBe('suppressed');
    expect(suppressed.suppressedReason).toBe('copy accepted');
    expect(audit.listAuditEvents({ namespaceId: w.docs.id, action: 'quality.suppressed' })).toHaveLength(1);

    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'home.subtitle',
      translations: { 'en-us': 'Hello {name}', 'zh-tw': '你好 {name}' },
      actorId: w.alice.id,
    });
    const secondScan = quality.scanQualityIssues(w.docs.id, w.alice.id);
    expect(secondScan.resolved).toBeGreaterThan(0);
    const missing = quality.listQualityIssues({
      namespaceId: w.docs.id,
      issueType: 'missing_translation',
      status: 'open',
      prefix: 'home.subtitle',
    });
    expect(missing).toHaveLength(0);
    const suppressedAfterFix = quality.listQualityIssues({
      namespaceId: w.docs.id,
      issueType: 'placeholder_mismatch',
      status: 'suppressed',
      prefix: 'home.subtitle',
    });
    expect(suppressedAfterFix).toHaveLength(1);
  });
});
