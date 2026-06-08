import { describe, it, expect } from 'vitest';

import { computeEtag } from '~/lib/services/snapshot.server';

describe('computeEtag', () => {
  it('produces deterministic etag', () => {
    expect(computeEtag(42, ['en-us', 'zh-cn'])).toBe(computeEtag(42, ['zh-cn', 'en-us']));
  });
  it('includes bundleVersion', () => {
    expect(computeEtag(1, ['zh-cn'])).not.toBe(computeEtag(2, ['zh-cn']));
  });
  it('includes atVersion when specified', () => {
    expect(computeEtag(10, ['zh-cn'])).not.toBe(computeEtag(10, ['zh-cn'], 5));
  });
});
