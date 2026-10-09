import { uuidv7 } from '@nxserve/domain';
import { type Logger, noopLogger } from './logger.js';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface IdentityCheck {
  ref: string;
  status: VerificationStatus;
}

/** KYB and identity verification (NX Verify), run before Moyasar submission. */
export interface IdentityVerifier {
  startCheck(input: {
    subjectType: 'tenant' | 'provider_org' | 'agent';
    legalName: string;
    nationalId?: string;
    cr?: string;
    iban?: string;
  }): Promise<IdentityCheck>;
  getCheck(ref: string): Promise<IdentityCheck>;
}

export type SigningStatus = 'requested' | 'signed' | 'declined' | 'expired';

/** National identity signing (Nafath) for merchant agreements. */
export interface NationalIdentity {
  requestSign(input: { nationalId: string; purpose: string }): Promise<{ ref: string; status: SigningStatus }>;
  getStatus(ref: string): Promise<{ ref: string; status: SigningStatus }>;
}

export class FakeIdentityVerifier implements IdentityVerifier {
  constructor(private readonly logger: Logger = noopLogger) {}

  startCheck(input: { legalName: string }): Promise<IdentityCheck> {
    this.logger.debug('nxverify.startCheck', { legalName: input.legalName });
    return Promise.resolve({ ref: `nxv_${uuidv7()}`, status: 'verified' });
  }

  getCheck(ref: string): Promise<IdentityCheck> {
    return Promise.resolve({ ref, status: 'verified' });
  }
}

export class FakeNationalIdentity implements NationalIdentity {
  requestSign(input: { nationalId: string }): Promise<{ ref: string; status: SigningStatus }> {
    void input.nationalId;
    return Promise.resolve({ ref: `nafath_${uuidv7()}`, status: 'signed' });
  }

  getStatus(ref: string): Promise<{ ref: string; status: SigningStatus }> {
    return Promise.resolve({ ref, status: 'signed' });
  }
}
