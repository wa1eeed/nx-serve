import { describe, expect, it } from 'vitest';
import { RegisterProviderSchema, UploadDocumentSchema } from './providers.js';

describe('UploadDocumentSchema scope consistency', () => {
  const base = { doc_type: 'vehicle_registration', file_url: 'https://files.example/doc.pdf' };

  it('accepts an org document with no subject ids', () => {
    expect(UploadDocumentSchema.safeParse({ ...base, applies_to: 'org' }).success).toBe(true);
  });

  it('requires agent_id for an agent document', () => {
    expect(UploadDocumentSchema.safeParse({ ...base, applies_to: 'agent' }).success).toBe(false);
    expect(
      UploadDocumentSchema.safeParse({ ...base, applies_to: 'agent', agent_id: '018f0000-0000-7000-8000-000000000001' }).success,
    ).toBe(true);
  });

  it('requires asset_id for an asset document', () => {
    expect(UploadDocumentSchema.safeParse({ ...base, applies_to: 'asset' }).success).toBe(false);
  });

  it('rejects a subject id that contradicts the scope', () => {
    expect(
      UploadDocumentSchema.safeParse({ ...base, applies_to: 'org', agent_id: '018f0000-0000-7000-8000-000000000001' }).success,
    ).toBe(false);
    expect(
      UploadDocumentSchema.safeParse({
        ...base,
        applies_to: 'agent',
        agent_id: '018f0000-0000-7000-8000-000000000001',
        asset_id: '018f0000-0000-7000-8000-000000000002',
      }).success,
    ).toBe(false);
  });

  it('rejects a calendar-impossible expiry date but accepts a real one', () => {
    expect(UploadDocumentSchema.safeParse({ ...base, applies_to: 'org', expires_on: '2026-02-31' }).success).toBe(false);
    expect(UploadDocumentSchema.safeParse({ ...base, applies_to: 'org', expires_on: '2026-13-01' }).success).toBe(false);
    expect(UploadDocumentSchema.safeParse({ ...base, applies_to: 'org', expires_on: '2026-12-31' }).success).toBe(true);
  });
});

describe('RegisterProviderSchema', () => {
  const ok = {
    entity_type: 'freelancer',
    legal_name: 'Ahmed Towing',
    display_name: 'Ahmed Towing',
    iban: 'SA0380000000608010167519',
    owner: { full_name: 'Ahmed', mobile: '+966500000010' },
  };

  it('accepts a valid freelancer registration', () => {
    expect(RegisterProviderSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects a malformed IBAN', () => {
    expect(RegisterProviderSchema.safeParse({ ...ok, iban: '123' }).success).toBe(false);
  });
});
