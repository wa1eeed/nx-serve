import { type Money } from '@nxserve/domain';
import { uuidv7 } from '@nxserve/domain';
import { type Logger, noopLogger } from './logger.js';

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitAmount: Money;
  vatAmount: Money;
}

export interface IssueInvoiceInput {
  sellerVatNumber: string;
  buyerName: string;
  lines: InvoiceLineInput[];
  total: Money;
  vatTotal: Money;
}

export interface IssuedInvoice {
  zatcaUuid: string;
  qr: string;
}

/** E-invoicing (ZATCA) behind the country pack interface. */
export interface EInvoicingProvider {
  issueInvoice(input: IssueInvoiceInput): Promise<IssuedInvoice>;
}

export class FakeEInvoicingProvider implements EInvoicingProvider {
  constructor(private readonly logger: Logger = noopLogger) {}

  issueInvoice(input: IssueInvoiceInput): Promise<IssuedInvoice> {
    this.logger.debug('zatca.issueInvoice', { buyer: input.buyerName });
    const zatcaUuid = uuidv7();
    return Promise.resolve({ zatcaUuid, qr: `fake-qr:${zatcaUuid}` });
  }
}
