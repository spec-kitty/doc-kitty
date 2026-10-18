import { describe, it, expect } from 'vitest';
import { STATUSES, okfStatusOf } from '../lib/vocabulary-core.mjs';

/**
 * `doc_status` → OKF `status` (#177, data-model). The mapping is total over the
 * canonical `STATUSES`: a status added to the vocabulary without a decision here
 * still maps (to `stable`), and this test enumerates the set so the new value is
 * seen in review.
 */
describe('okfStatusOf is total over STATUSES', () => {
  const OKF = ['draft', 'stable', 'deprecated'];

  it.each(STATUSES)('%s maps to a valid OKF status', (status) => {
    expect(OKF).toContain(okfStatusOf(status));
  });

  it('pins the documented mapping', () => {
    expect(Object.fromEntries(STATUSES.map((s) => [s, okfStatusOf(s)]))).toEqual({
      draft: 'draft',
      active: 'stable',
      deprecated: 'deprecated',
      superseded: 'deprecated',
      durable: 'stable',
    });
  });

  it('an absent status is stable', () => {
    expect(okfStatusOf(undefined)).toBe('stable');
    expect(okfStatusOf(null)).toBe('stable');
  });

  it('an unknown (charter-added) status is stable', () => {
    expect(okfStatusOf('archived')).toBe('stable');
  });
});
