import { type Logger, noopLogger } from './logger.js';
import { FakePaymentGateway, type PaymentGateway } from './payment-gateway.js';
import { FakeMapsProvider, type MapsProvider } from './maps.js';
import { ConsoleNotificationProvider, type NotificationProvider } from './notifications.js';
import { FakeStorageProvider, type StorageProvider } from './storage.js';
import {
  FakeIdentityVerifier,
  FakeNationalIdentity,
  type IdentityVerifier,
  type NationalIdentity,
} from './identity.js';
import { FakeEInvoicingProvider, type EInvoicingProvider } from './einvoicing.js';
import { FakeRegulatoryFilingProvider, type RegulatoryFilingProvider } from './regulatory.js';

/** The full set of external adapters the application depends on. */
export interface Integrations {
  payments: PaymentGateway;
  maps: MapsProvider;
  notifications: NotificationProvider;
  storage: StorageProvider;
  identity: IdentityVerifier;
  nationalIdentity: NationalIdentity;
  einvoicing: EInvoicingProvider;
  regulatory: RegulatoryFilingProvider;
}

/** All fake adapters, for local dev and tests. */
export function createFakeIntegrations(logger: Logger = noopLogger): Integrations {
  return {
    payments: new FakePaymentGateway(logger),
    maps: new FakeMapsProvider(logger),
    notifications: new ConsoleNotificationProvider(logger),
    storage: new FakeStorageProvider(logger),
    identity: new FakeIdentityVerifier(logger),
    nationalIdentity: new FakeNationalIdentity(),
    einvoicing: new FakeEInvoicingProvider(logger),
    regulatory: new FakeRegulatoryFilingProvider(logger),
  };
}

/**
 * Selects adapters from the environment. In Phase 0 only fakes exist; real
 * adapters (Moyasar, Google Maps, SMS, WhatsApp, SMTP, OSS, NX Verify, Nafath,
 * ZATCA) are added in later phases and chosen per country pack and tenant. The
 * default keeps payments off and gateway replaceable (founder guidance).
 */
export function createIntegrations(env: NodeJS.ProcessEnv = process.env): Integrations {
  void env;
  return createFakeIntegrations();
}
