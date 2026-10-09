import { describe, expect, it } from 'vitest';
import { money } from '@nxserve/domain';
import {
  FakePaymentGateway,
  assertSplitsBalance,
  constantTimeEquals,
  createFakeIntegrations,
} from './index.js';

describe('FakePaymentGateway', () => {
  it('authorizes when splits balance and enforces capture <= authorized', async () => {
    const gw = new FakePaymentGateway();
    const amount = money(10000n, 'SAR');
    const auth = await gw.authorize({
      idempotencyKey: 'k1',
      merchantId: 'm1',
      amount,
      splits: [
        { recipientType: 'provider', recipientRef: 'm1', amount: money(8902n, 'SAR'), isFeeSource: true },
        { recipientType: 'platform', recipientRef: 'p1', amount: money(1098n, 'SAR') },
      ],
    });
    expect(auth.status).toBe('authorized');

    const cap = await gw.capture(auth.id, money(9000n, 'SAR'));
    expect(cap.status).toBe('partially_captured');
    await expect(gw.capture(auth.id, money(20000n, 'SAR'))).rejects.toThrow();
  });

  it('rejects unbalanced splits, two fee sources and negative entity splits', () => {
    const amount = money(10000n, 'SAR');
    expect(() =>
      assertSplitsBalance(amount, [{ recipientType: 'provider', recipientRef: 'm', amount: money(9999n, 'SAR') }]),
    ).toThrow();
    expect(() =>
      assertSplitsBalance(amount, [
        { recipientType: 'provider', recipientRef: 'm', amount: money(5000n, 'SAR'), isFeeSource: true },
        { recipientType: 'platform', recipientRef: 'p', amount: money(5000n, 'SAR'), isFeeSource: true },
      ]),
    ).toThrow();
    expect(() =>
      assertSplitsBalance(amount, [
        { recipientType: 'provider', recipientRef: 'm', amount: money(-1n, 'SAR') },
        { recipientType: 'platform', recipientRef: 'p', amount: money(10001n, 'SAR') },
      ]),
    ).toThrow();
  });

  it('verifies webhooks by constant time secret and IP allow list', () => {
    const gw = new FakePaymentGateway();
    expect(gw.verifyWebhook({ sharedSecret: 's', receivedSecret: 's' })).toBe(true);
    expect(gw.verifyWebhook({ sharedSecret: 's', receivedSecret: 'x' })).toBe(false);
    expect(
      gw.verifyWebhook({ sharedSecret: 's', receivedSecret: 's', sourceIp: '9.9.9.9', allowedIps: ['1.1.1.1'] }),
    ).toBe(false);
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
  });
});

describe('createFakeIntegrations', () => {
  it('provides a working fake for every adapter', async () => {
    const i = createFakeIntegrations();
    const route = await i.maps.route([
      { lat: 24.7, lng: 46.6 },
      { lat: 24.8, lng: 46.7 },
    ]);
    expect(route.totalDistanceKm).toBeGreaterThan(0);

    await i.storage.putObject({ key: 'a/b.txt', body: new Uint8Array([1]), contentType: 'text/plain' });
    expect(await i.storage.getSignedUrl('a/b.txt')).toContain('a%2Fb.txt');

    const sms = await i.notifications.sendSms({ to: '+966500000000', body: 'hi' });
    expect(sms.status).toBe('sent');

    const check = await i.identity.startCheck({ subjectType: 'provider_org', legalName: 'ACME' });
    expect(check.status).toBe('verified');
  });
});
