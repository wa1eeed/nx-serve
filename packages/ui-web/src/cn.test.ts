import { describe, expect, it } from 'vitest';
import { cn } from './cn.js';

describe('cn', () => {
  it('joins truthy classes', () => {
    expect(cn('a', false, 'b', undefined, 'c')).toBe('a b c');
  });

  it('resolves conflicting Tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
