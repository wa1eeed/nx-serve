import { Injectable } from '@nestjs/common';

/** Typed access to environment configuration (twelve factor; docs/13). */
@Injectable()
export class ConfigService {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly port = Number(process.env.API_PORT ?? 3001);
  readonly publicUrl = process.env.API_PUBLIC_URL ?? 'http://localhost:3001';
  readonly platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost';
  readonly stagingDomain = process.env.PLATFORM_STAGING_DOMAIN ?? '';
  readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  readonly jwtAccessSecret = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';
  readonly jwtRefreshSecret = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me';
  readonly accessTtlSeconds = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900);
  readonly refreshTtlSeconds = Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2_592_000);
  readonly otpTtlSeconds = Number(process.env.OTP_TTL_SECONDS ?? 300);

  readonly paymentsEnabled = (process.env.PAYMENTS_ENABLED ?? 'false') === 'true';

  // Gateway webhook verification (docs/06, Q9): a shared secret plus an optional
  // source IP allowlist. The webhook is rejected when no secret is configured.
  readonly moyasarWebhookSecret = process.env.MOYASAR_WEBHOOK_SHARED_SECRET ?? '';
  readonly webhookAllowedIps = (process.env.WEBHOOK_ALLOWED_IPS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
