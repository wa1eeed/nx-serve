import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { type CategoryRequirement, type ProviderDocument, resolveDocuments } from './documents.js';

const NOW = '2026-02-01T00:00:00.000Z';

const reqs: CategoryRequirement[] = [
  { docType: 'vehicle_registration', appliesTo: 'org', required: true, expires: false },
  { docType: 'operating_permit', appliesTo: 'org', required: true, expires: true },
];

describe('resolveDocuments', () => {
  it('reports missing required documents', () => {
    const r = resolveDocuments({ requirements: reqs, documents: [], now: NOW });
    expect(r.allRequiredSatisfied).toBe(false);
    expect(r.blockingRequired).toEqual(['vehicle_registration', 'operating_permit']);
  });

  it('satisfies when verified and not expired', () => {
    const docs: ProviderDocument[] = [
      { docType: 'vehicle_registration', appliesTo: 'org', status: 'verified' },
      { docType: 'operating_permit', appliesTo: 'org', status: 'verified', expiresOn: '2026-12-31' },
    ];
    const r = resolveDocuments({ requirements: reqs, documents: docs, now: NOW });
    expect(r.allRequiredSatisfied).toBe(true);
    expect(r.blockingRequired).toEqual([]);
  });

  it('treats a verified but past-expiry document as expired and blocking', () => {
    const docs: ProviderDocument[] = [
      { docType: 'vehicle_registration', appliesTo: 'org', status: 'verified' },
      { docType: 'operating_permit', appliesTo: 'org', status: 'verified', expiresOn: '2026-01-15' },
    ];
    const r = resolveDocuments({ requirements: reqs, documents: docs, now: NOW });
    expect(r.allRequiredSatisfied).toBe(false);
    expect(r.blockingRequired).toEqual(['operating_permit']);
    expect(r.items.find((i) => i.docType === 'operating_permit')!.state).toBe('expired');
  });

  it('flags a soon-to-expire document while still satisfied', () => {
    const docs: ProviderDocument[] = [
      { docType: 'vehicle_registration', appliesTo: 'org', status: 'verified' },
      { docType: 'operating_permit', appliesTo: 'org', status: 'verified', expiresOn: '2026-02-20' },
    ];
    const r = resolveDocuments({ requirements: reqs, documents: docs, now: NOW, expiringWithinDays: 30 });
    expect(r.allRequiredSatisfied).toBe(true);
    expect(r.expiring).toEqual(['operating_permit']);
  });

  it('does not flag expiring when a renewal extends coverage past the window', () => {
    const docs: ProviderDocument[] = [
      { docType: 'operating_permit', appliesTo: 'org', status: 'verified', expiresOn: '2026-02-20' }, // soon
      { docType: 'operating_permit', appliesTo: 'org', status: 'verified', expiresOn: '2027-02-20' }, // renewed
    ];
    const r = resolveDocuments({
      requirements: [{ docType: 'operating_permit', appliesTo: 'org', required: true, expires: true }],
      documents: docs,
      now: NOW,
      expiringWithinDays: 30,
    });
    expect(r.allRequiredSatisfied).toBe(true);
    expect(r.expiring).toEqual([]);
  });

  it('marks a pending document as pending, not missing', () => {
    const docs: ProviderDocument[] = [{ docType: 'vehicle_registration', appliesTo: 'org', status: 'pending' }];
    const r = resolveDocuments({ requirements: reqs, documents: docs, now: NOW });
    expect(r.pendingRequired).toEqual(['vehicle_registration']);
    expect(r.items.find((i) => i.docType === 'vehicle_registration')!.state).toBe('pending');
  });

  it('prefers the most-satisfied document when several match', () => {
    const docs: ProviderDocument[] = [
      { docType: 'vehicle_registration', appliesTo: 'org', status: 'rejected' },
      { docType: 'vehicle_registration', appliesTo: 'org', status: 'verified' },
    ];
    const r = resolveDocuments({
      requirements: [{ docType: 'vehicle_registration', appliesTo: 'org', required: true, expires: false }],
      documents: docs,
      now: NOW,
    });
    expect(r.allRequiredSatisfied).toBe(true);
  });

  it('matches documents to the requirement scope (org vs agent)', () => {
    const r = resolveDocuments({
      requirements: [{ docType: 'license', appliesTo: 'agent', required: true, expires: false }],
      documents: [{ docType: 'license', appliesTo: 'org', status: 'verified' }],
      now: NOW,
    });
    expect(r.allRequiredSatisfied).toBe(false); // org doc does not satisfy an agent requirement
  });

  it('ignores optional requirements for allRequiredSatisfied', () => {
    const r = resolveDocuments({
      requirements: [{ docType: 'insurance', appliesTo: 'org', required: false, expires: false }],
      documents: [],
      now: NOW,
    });
    expect(r.allRequiredSatisfied).toBe(true);
    expect(r.blockingRequired).toEqual([]);
  });

  it('property: allRequiredSatisfied iff no required requirement is unsatisfied', () => {
    const stateArb = fc.constantFrom('verified', 'pending', 'rejected', 'expired' as const);
    fc.assert(
      fc.property(fc.array(fc.record({ required: fc.boolean(), status: stateArb }), { maxLength: 10 }), (rows) => {
        const requirements: CategoryRequirement[] = rows.map((row, i) => ({
          docType: `d${i}`,
          appliesTo: 'org',
          required: row.required,
          expires: false,
        }));
        const documents: ProviderDocument[] = rows.map((row, i) => ({
          docType: `d${i}`,
          appliesTo: 'org',
          status: row.status,
        }));
        const r = resolveDocuments({ requirements, documents, now: NOW });
        const expected = rows.every((row) => !row.required || row.status === 'verified');
        return r.allRequiredSatisfied === expected;
      }),
    );
  });
});
