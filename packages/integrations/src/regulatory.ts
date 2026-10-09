import { uuidv7 } from '@nxserve/domain';
import { type Logger, noopLogger } from './logger.js';

/**
 * External regulatory filings in the country pack (docs/25 B4), for example a
 * land freight electronic waybill. Scope and integration are open (docs/16 Q21),
 * so this is an interface with a fake until confirmed.
 */
export interface RegulatoryFilingProvider {
  file(input: {
    kind: string;
    orderRef: string;
    payload: Record<string, unknown>;
  }): Promise<{ ref: string; status: 'accepted' | 'pending' | 'rejected' }>;
}

export class FakeRegulatoryFilingProvider implements RegulatoryFilingProvider {
  constructor(private readonly logger: Logger = noopLogger) {}

  file(input: { kind: string; orderRef: string }): Promise<{
    ref: string;
    status: 'accepted' | 'pending' | 'rejected';
  }> {
    this.logger.debug('regulatory.file', { kind: input.kind, orderRef: input.orderRef });
    return Promise.resolve({ ref: `filing_${uuidv7()}`, status: 'accepted' });
  }
}
