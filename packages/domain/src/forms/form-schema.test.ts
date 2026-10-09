import { describe, expect, it } from 'vitest';
import { type ServiceFieldDef, buildFormSchema, resolveText } from './form-schema.js';

describe('resolveText', () => {
  it('resolves to the locale and falls back to en', () => {
    expect(resolveText({ en: 'Vehicle', ar: 'المركبة' }, 'ar')).toBe('المركبة');
    expect(resolveText({ en: 'Vehicle', ar: 'المركبة' }, 'en')).toBe('Vehicle');
    expect(resolveText({ en: 'Vehicle', ar: '' }, 'ar')).toBe('Vehicle');
    expect(resolveText({ en: 'Vehicle' }, 'ar')).toBe('Vehicle');
  });
});

describe('buildFormSchema fulfillment fields', () => {
  const base = { version: 'v1', locale: 'en' as const, tracking: 'full_trip' as const, serviceFields: [] };

  it('derives location fields per mode', () => {
    expect(buildFormSchema({ ...base, fulfillment: 'at_customer' }).sections[0]?.fields.map((f) => f.key)).toEqual(['origin']);
    expect(buildFormSchema({ ...base, fulfillment: 'point_to_point' }).sections[0]?.fields.map((f) => f.key)).toEqual(['origin', 'destination']);
    expect(buildFormSchema({ ...base, fulfillment: 'at_provider' }).sections[0]?.fields.map((f) => f.key)).toEqual(['provider_branch', 'appointment_slot']);
    expect(buildFormSchema({ ...base, fulfillment: 'remote' }).sections[0]?.fields).toEqual([]);
  });
});

describe('buildFormSchema service fields', () => {
  const field = (over: Partial<ServiceFieldDef> & Pick<ServiceFieldDef, 'key' | 'dataType' | 'label'>): ServiceFieldDef => ({
    required: false,
    ...over,
  });

  it('renders localized labels, options and flags', () => {
    const schema = buildFormSchema({
      version: 'v7',
      locale: 'ar',
      fulfillment: 'point_to_point',
      tracking: 'full_trip',
      serviceFields: [
        field({ key: 'condition', dataType: 'single_select', required: true, label: { en: 'Condition', ar: 'الحالة' }, options: [{ value: 'runs', label: { en: 'Runs', ar: 'يعمل' } }], validation: { min: 0 }, visibility: { key: 'x', eq: true } }),
        field({ key: 'items', dataType: 'item_list', label: { en: 'Items', ar: 'العناصر' }, allowCustomItems: true }),
        field({ key: 'vehicle', dataType: 'reference', label: { en: 'Vehicle', ar: 'المركبة' }, referenceSource: 'vehicle_model' }),
      ],
    });
    expect(schema.version).toBe('v7');
    const service = schema.sections[1]?.fields ?? [];
    expect(service[0]).toMatchObject({
      key: 'condition',
      label: 'الحالة',
      required: true,
      options: [{ value: 'runs', label: 'يعمل' }],
      validation: { min: 0 },
      visibility: { key: 'x', eq: true },
    });
    expect(service[1]?.allow_custom).toBe(true);
    expect(service[2]?.reference_source).toBe('vehicle_model');
  });

  it('omits fields that require a missing module and keeps them otherwise', () => {
    const fields: ServiceFieldDef[] = [
      field({ key: 'gated', dataType: 'text', label: { en: 'Gated' }, requiresModule: 'quotes' }),
      field({ key: 'open', dataType: 'text', label: { en: 'Open' } }),
    ];
    const withoutModule = buildFormSchema({ version: 'v1', locale: 'en', fulfillment: 'remote', tracking: 'none', serviceFields: fields, entitledModules: new Set(['other']) });
    expect(withoutModule.sections[1]?.fields.map((f) => f.key)).toEqual(['open']);

    const withModule = buildFormSchema({ version: 'v1', locale: 'en', fulfillment: 'remote', tracking: 'none', serviceFields: fields, entitledModules: new Set(['quotes']) });
    expect(withModule.sections[1]?.fields.map((f) => f.key)).toEqual(['gated', 'open']);

    const noEntitlementInfo = buildFormSchema({ version: 'v1', locale: 'en', fulfillment: 'remote', tracking: 'none', serviceFields: fields });
    expect(noEntitlementInfo.sections[1]?.fields.map((f) => f.key)).toEqual(['gated', 'open']);
  });
});
