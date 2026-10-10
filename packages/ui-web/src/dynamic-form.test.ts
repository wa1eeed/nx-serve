import { describe, expect, it } from 'vitest';
import type { FormSchema } from '@nxserve/domain';
import { isRenderedFieldVisible, visibleFields } from './dynamic-form.js';

const schema: FormSchema = {
  version: 'v1',
  locale: 'en',
  fulfillment: 'at_customer',
  tracking: 'none',
  sections: [
    { key: 'fulfillment', fields: [{ key: 'origin', type: 'location', required: true, i18n_key: 'fields.origin' }] },
    {
      key: 'service',
      fields: [
        { key: 'is_basement', type: 'boolean', required: false, label: 'Basement?' },
        {
          key: 'basement_clearance_m',
          type: 'number',
          required: true,
          label: 'Clearance',
          visibility: { key: 'is_basement', eq: true },
        },
        {
          key: 'gate',
          type: 'single_select',
          required: false,
          label: 'Gate',
          visibility: { key: 'is_basement', ne: true },
        },
      ],
    },
  ],
};

describe('isRenderedFieldVisible', () => {
  it('shows a field with no visibility rule', () => {
    expect(isRenderedFieldVisible(schema.sections[0]!.fields[0]!, {})).toBe(true);
  });

  it('applies an eq rule', () => {
    const field = schema.sections[1]!.fields[1]!;
    expect(isRenderedFieldVisible(field, { is_basement: true })).toBe(true);
    expect(isRenderedFieldVisible(field, { is_basement: false })).toBe(false);
    expect(isRenderedFieldVisible(field, {})).toBe(false);
  });

  it('applies a ne rule', () => {
    const field = schema.sections[1]!.fields[2]!;
    expect(isRenderedFieldVisible(field, { is_basement: true })).toBe(false);
    expect(isRenderedFieldVisible(field, { is_basement: false })).toBe(true);
  });

  it('applies an in rule', () => {
    const field = { key: 'x', type: 'text' as const, required: false, visibility: { key: 'g', in: ['a', 'b'] } };
    expect(isRenderedFieldVisible(field, { g: 'a' })).toBe(true);
    expect(isRenderedFieldVisible(field, { g: 'c' })).toBe(false);
  });
});

describe('visibleFields', () => {
  it('flattens sections and hides fields whose rule is unmet', () => {
    const base = visibleFields(schema, {});
    expect(base.map((f) => f.key)).toEqual(['origin', 'is_basement', 'gate']);

    const withBasement = visibleFields(schema, { is_basement: true });
    expect(withBasement.map((f) => f.key)).toEqual(['origin', 'is_basement', 'basement_clearance_m']);
  });
});
