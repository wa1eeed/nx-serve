import {
  type Money,
  compareMoney,
  isNegativeMoney,
  sumMoney,
  uuidv7,
} from '@nxserve/domain';
import { type Logger, noopLogger } from './logger.js';

/**
 * Gateway capabilities, so the app can branch on what the active gateway and
 * merchant support without naming a vendor (docs/16 Q8). Moyasar is the first
 * adapter; the interface stays gateway agnostic.
 */
export interface GatewayCapabilities {
  splitPayments: boolean;
  tokenization: boolean;
  applePayWeb: boolean;
  stcPay: boolean;
  amex: boolean;
}

export type MerchantStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'missing_docs'
  | 'semi_active'
  | 'active'
  | 'hold'
  | 'rejected'
  | 'disabled';

export interface CreateMerchantInput {
  entityType: 'freelancer' | 'establishment' | 'company';
  legalName: string;
  iban: string;
  metadata?: Record<string, unknown>;
}

export interface Merchant {
  id: string;
  status: MerchantStatus;
  requiredDocuments: string[];
}

export type SplitRecipientType = 'provider' | 'platform' | 'beneficiary';

export interface SplitInput {
  recipientType: SplitRecipientType;
  recipientRef: string;
  amount: Money;
  isFeeSource?: boolean;
  refundable?: boolean;
}

export interface AuthorizeInput {
  idempotencyKey: string;
  merchantId: string;
  amount: Money;
  cardTokenRef?: string;
  splits: SplitInput[];
}

export type PaymentGatewayStatus =
  | 'initiated'
  | 'authorized'
  | 'captured'
  | 'partially_captured'
  | 'voided'
  | 'refunded'
  | 'partially_refunded'
  | 'failed'
  | 'expired';

export interface PaymentResult {
  id: string;
  status: PaymentGatewayStatus;
  authorizedAmount: Money;
  capturedAmount: Money;
  refundedAmount: Money;
}

export interface WebhookVerifyInput {
  sharedSecret: string;
  receivedSecret: string;
  sourceIp?: string;
  allowedIps?: string[];
}

/** The payment gateway behind which Moyasar (and any alternative) sits. */
export interface PaymentGateway {
  readonly capabilities: GatewayCapabilities;
  createMerchant(input: CreateMerchantInput): Promise<Merchant>;
  getMerchant(merchantId: string): Promise<Merchant>;
  authorize(input: AuthorizeInput): Promise<PaymentResult>;
  capture(paymentId: string, amount?: Money): Promise<PaymentResult>;
  void(paymentId: string): Promise<PaymentResult>;
  refund(paymentId: string, amount?: Money): Promise<PaymentResult>;
  fetchPayment(paymentId: string): Promise<PaymentResult>;
  /** Constant time shared secret check plus optional IP allow list (docs/16 Q9). */
  verifyWebhook(input: WebhookVerifyInput): boolean;
}

export class SplitImbalanceError extends Error {
  constructor() {
    super('Splits must sum exactly to the payment amount');
    this.name = 'SplitImbalanceError';
  }
}

/** Constant time string comparison to avoid timing leaks on the shared secret. */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Validates the universal split invariants before any gateway call. */
export function assertSplitsBalance(amount: Money, splits: readonly SplitInput[]): void {
  const feeSources = splits.filter((s) => s.isFeeSource === true);
  if (feeSources.length > 1) {
    throw new SplitImbalanceError();
  }
  for (const s of splits) {
    if (s.recipientType !== 'platform' && isNegativeMoney(s.amount)) {
      // Only platform splits may be negative (promo funding); entity splits cannot.
      throw new SplitImbalanceError();
    }
  }
  const total = sumMoney(
    splits.map((s) => s.amount),
    amount.currency,
  );
  if (compareMoney(total, amount) !== 0) {
    throw new SplitImbalanceError();
  }
}

interface FakePaymentRecord {
  result: PaymentResult;
}

/**
 * In-memory fake gateway for local dev and tests. Enforces the real invariants
 * (splits balance, capture <= authorized) so code paths behave like production
 * without any network or stored funds.
 */
export class FakePaymentGateway implements PaymentGateway {
  readonly capabilities: GatewayCapabilities = {
    splitPayments: true,
    tokenization: true,
    applePayWeb: false,
    stcPay: false,
    amex: false,
  };

  private readonly payments = new Map<string, FakePaymentRecord>();
  private readonly merchants = new Map<string, Merchant>();

  constructor(private readonly logger: Logger = noopLogger) {}

  createMerchant(input: CreateMerchantInput): Promise<Merchant> {
    const merchant: Merchant = {
      id: `fake_merchant_${uuidv7()}`,
      status: 'active',
      requiredDocuments: [],
    };
    this.merchants.set(merchant.id, merchant);
    this.logger.debug('createMerchant', { legalName: input.legalName });
    return Promise.resolve(merchant);
  }

  getMerchant(merchantId: string): Promise<Merchant> {
    const merchant = this.merchants.get(merchantId) ?? {
      id: merchantId,
      status: 'active' as const,
      requiredDocuments: [],
    };
    return Promise.resolve(merchant);
  }

  authorize(input: AuthorizeInput): Promise<PaymentResult> {
    assertSplitsBalance(input.amount, input.splits);
    const zero: Money = { amountMinor: 0n, currency: input.amount.currency };
    const result: PaymentResult = {
      id: `fake_pay_${uuidv7()}`,
      status: 'authorized',
      authorizedAmount: input.amount,
      capturedAmount: zero,
      refundedAmount: zero,
    };
    this.payments.set(result.id, { result });
    this.logger.debug('authorize', { id: result.id });
    return Promise.resolve(result);
  }

  capture(paymentId: string, amount?: Money): Promise<PaymentResult> {
    const record = this.require(paymentId);
    const captured = amount ?? record.result.authorizedAmount;
    if (compareMoney(captured, record.result.authorizedAmount) > 0) {
      return Promise.reject(new Error('Capture cannot exceed the authorized amount'));
    }
    const full = compareMoney(captured, record.result.authorizedAmount) === 0;
    record.result = {
      ...record.result,
      status: full ? 'captured' : 'partially_captured',
      capturedAmount: captured,
    };
    return Promise.resolve(record.result);
  }

  void(paymentId: string): Promise<PaymentResult> {
    const record = this.require(paymentId);
    record.result = { ...record.result, status: 'voided' };
    return Promise.resolve(record.result);
  }

  refund(paymentId: string, amount?: Money): Promise<PaymentResult> {
    const record = this.require(paymentId);
    const refunded = amount ?? record.result.capturedAmount;
    const full = compareMoney(refunded, record.result.capturedAmount) === 0;
    record.result = {
      ...record.result,
      status: full ? 'refunded' : 'partially_refunded',
      refundedAmount: refunded,
    };
    return Promise.resolve(record.result);
  }

  fetchPayment(paymentId: string): Promise<PaymentResult> {
    return Promise.resolve(this.require(paymentId).result);
  }

  verifyWebhook(input: WebhookVerifyInput): boolean {
    // Fail closed: when an allowlist is configured, an unknown source IP is rejected.
    if (input.allowedIps && input.allowedIps.length > 0) {
      if (!input.sourceIp || !input.allowedIps.includes(input.sourceIp)) {
        return false;
      }
    }
    return constantTimeEquals(input.sharedSecret, input.receivedSecret);
  }

  private require(paymentId: string): FakePaymentRecord {
    const record = this.payments.get(paymentId);
    if (!record) {
      throw new Error(`Unknown payment ${paymentId}`);
    }
    return record;
  }
}
