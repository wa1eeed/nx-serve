import { describe, expect, it } from 'vitest';
import { type FieldDefinition, isFieldVisible, validateFields } from './validate.js';

const def = (over: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'dataType'>): FieldDefinition => ({
  required: false,
  ...over,
});

describe('isFieldVisible', () => {
  it('is visible without a rule, and honours eq, ne and in', () => {
    expect(isFieldVisible(def({ key: 'a', dataType: 'text' }), {})).toBe(true);
    expect(
      isFieldVisible(def({ key: 'a', dataType: 'text', visibility: { key: 'b', eq: true } }), { b: true }),
    ).toBe(true);
    expect(
      isFieldVisible(def({ key: 'a', dataType: 'text', visibility: { key: 'b', eq: true } }), { b: false }),
    ).toBe(false);
    expect(
      isFieldVisible(def({ key: 'a', dataType: 'text', visibility: { key: 'b', ne: 'x' } }), { b: 'y' }),
    ).toBe(true);
    expect(
      isFieldVisible(def({ key: 'a', dataType: 'text', visibility: { key: 'b', in: ['x', 'y'] } }), { b: 'y' }),
    ).toBe(true);
    expect(
      isFieldVisible(def({ key: 'a', dataType: 'text', visibility: { key: 'b', in: ['x'] } }), { b: 'y' }),
    ).toBe(false);
    expect(isFieldVisible(def({ key: 'a', dataType: 'text', visibility: { key: 'b' } }), {})).toBe(true);
  });
});

describe('validateFields', () => {
  it('enforces required only on visible fields', () => {
    const defs = [
      def({ key: 'plate', dataType: 'text', required: true }),
      def({ key: 'basement', dataType: 'text', required: true, visibility: { key: 'has_basement', eq: true } }),
    ];
    expect(validateFields(defs, { plate: 'ABC', has_basement: false }).valid).toBe(true);
    const r = validateFields(defs, { has_basement: true });
    expect(r.valid).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain('required');
  });

  it('validates text length and regex', () => {
    const defs = [def({ key: 't', dataType: 'text', validation: { minLength: 2, maxLength: 4, regex: '^[a-z]+$' } })];
    expect(validateFields(defs, { t: 'ab' }).valid).toBe(true);
    expect(validateFields(defs, { t: 'a' }).errors[0]?.code).toBe('min_length');
    expect(validateFields(defs, { t: 'abcde' }).errors[0]?.code).toBe('max_length');
    expect(validateFields(defs, { t: 'AB' }).errors[0]?.code).toBe('pattern');
    expect(validateFields(defs, { t: 5 }).errors[0]?.code).toBe('type');
  });

  it('validates numbers, booleans, dates and locations', () => {
    expect(validateFields([def({ key: 'n', dataType: 'number', validation: { min: 1, max: 10 } })], { n: 0 }).errors[0]?.code).toBe('min');
    expect(validateFields([def({ key: 'n', dataType: 'number', validation: { min: 1, max: 10 } })], { n: 11 }).errors[0]?.code).toBe('max');
    expect(validateFields([def({ key: 'n', dataType: 'number' })], { n: 'x' }).errors[0]?.code).toBe('type');
    expect(validateFields([def({ key: 'b', dataType: 'boolean' })], { b: 'x' }).errors[0]?.code).toBe('type');
    expect(validateFields([def({ key: 'b', dataType: 'boolean' })], { b: true }).valid).toBe(true);
    expect(validateFields([def({ key: 'd', dataType: 'date' })], { d: 'not-a-date' }).errors[0]?.code).toBe('type');
    expect(validateFields([def({ key: 'd', dataType: 'date' })], { d: '2026-10-10' }).valid).toBe(true);
    expect(validateFields([def({ key: 'l', dataType: 'location' })], { l: { lat: 1 } }).errors[0]?.code).toBe('type');
    expect(validateFields([def({ key: 'l', dataType: 'location' })], { l: { lat: 1, lng: 2 } }).valid).toBe(true);
  });

  it('validates selects, media and reference', () => {
    const single = [def({ key: 's', dataType: 'single_select', options: ['a', 'b'] })];
    expect(validateFields(single, { s: 'c' }).errors[0]?.code).toBe('not_in_options');
    expect(validateFields(single, { s: 5 }).errors[0]?.code).toBe('type');
    const multi = [def({ key: 'm', dataType: 'multi_select', options: ['a', 'b'] })];
    expect(validateFields(multi, { m: ['a', 'c'] }).errors[0]?.code).toBe('not_in_options');
    expect(validateFields(multi, { m: 'a' }).errors[0]?.code).toBe('type');
    expect(validateFields([def({ key: 'me', dataType: 'media' })], { me: 'x' }).errors[0]?.code).toBe('type');
    expect(validateFields([def({ key: 'r', dataType: 'reference' })], { r: 123 }).errors[0]?.code).toBe('empty_reference');
    expect(validateFields([def({ key: 'r', dataType: 'reference' })], { r: 'veh_1' }).valid).toBe(true);
  });

  it('validates item_list including custom items and quantity', () => {
    const defs = [def({ key: 'items', dataType: 'item_list', allowCustomItems: false })];
    expect(validateFields(defs, { items: 'x' }).errors[0]?.code).toBe('type');
    expect(validateFields(defs, { items: [{ quantity: 1 }] }).errors[0]?.code).toBe('invalid_item');
    expect(validateFields(defs, { items: [{ custom_name: 'sofa', quantity: 1 }] }).errors[0]?.code).toBe('custom_not_allowed');
    expect(validateFields(defs, { items: [{ catalog_item_id: 'c1', quantity: 0 }] }).errors[0]?.code).toBe('invalid_quantity');
    expect(validateFields(defs, { items: [{ catalog_item_id: 'c1', quantity: 2 }] }).valid).toBe(true);
    const custom = [def({ key: 'items', dataType: 'item_list', allowCustomItems: true })];
    expect(validateFields(custom, { items: [{ custom_name: 'sofa', quantity: 1 }] }).valid).toBe(true);
  });
});
