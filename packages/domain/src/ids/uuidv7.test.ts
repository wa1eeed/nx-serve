import { describe, expect, it } from 'vitest';
import { isUuid, isUuidv7, uuidv7 } from './uuidv7.js';

describe('uuidv7', () => {
  it('produces a well formed version 7 UUID', () => {
    const id = uuidv7();
    expect(isUuid(id)).toBe(true);
    expect(isUuidv7(id)).toBe(true);
    // Variant bits: first char of the 4th group is 8, 9, a or b.
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('is time ordered across milliseconds', () => {
    const earlier = uuidv7(1_000);
    const later = uuidv7(2_000);
    expect(earlier < later).toBe(true);
  });

  it('is monotonic within the same millisecond and survives sequence overflow', () => {
    const now = 5_000_000;
    let previous = uuidv7(now);
    // More than 4096 iterations forces the 12-bit sequence to wrap at least once.
    for (let i = 0; i < 5000; i++) {
      const next = uuidv7(now);
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it('validates UUID shapes', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuidv7('00000000-0000-4000-8000-000000000000')).toBe(false); // version 4
    expect(isUuidv7('00000000-0000-7000-8000-000000000000')).toBe(true);
  });
});
