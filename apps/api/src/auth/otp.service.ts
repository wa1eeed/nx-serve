import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { uuidv7 } from '@nxserve/domain';
import { type Integrations } from '@nxserve/integrations';
import { ConfigService } from '../config/config.service.js';
import { DbService } from '../db/db.service.js';
import { AppException } from '../common/app-exception.js';
import { INTEGRATIONS } from '../integrations/integrations.module.js';

const MAX_ATTEMPTS = 5;

interface OtpRow {
  tenant_id: string;
  subject_type: 'customer' | 'agent';
  mobile: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Phone OTP challenges for customers and agents (docs/18). */
@Injectable()
export class OtpService {
  constructor(
    private readonly config: ConfigService,
    private readonly db: DbService,
    @Inject(INTEGRATIONS) private readonly integrations: Integrations,
  ) {}

  async create(tenantId: string, subjectType: 'customer' | 'agent', mobile: string): Promise<string> {
    const code = String(randomInt(100_000, 1_000_000));
    const id = uuidv7();
    const expiresAt = new Date(Date.now() + this.config.otpTtlSeconds * 1000);
    await this.db.admin.query(
      `INSERT INTO otp_challenges (id, tenant_id, subject_type, mobile, code_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, tenantId, subjectType, mobile, sha256(code), expiresAt],
    );
    await this.integrations.notifications.sendSms({ to: mobile, body: `NX Serve code: ${code}` });
    return id;
  }

  async verify(
    challengeId: string,
    code: string,
  ): Promise<{ tenantId: string; subjectType: 'customer' | 'agent'; mobile: string }> {
    const res = await this.db.admin.query<OtpRow>(
      `SELECT tenant_id, subject_type, mobile, code_hash, attempts, expires_at, consumed_at
       FROM otp_challenges WHERE id = $1`,
      [challengeId],
    );
    const row = res.rows[0];
    if (!row || row.consumed_at || row.expires_at.getTime() < Date.now() || row.attempts >= MAX_ATTEMPTS) {
      throw new AppException('unauthorized', { detail: 'Invalid or expired code' });
    }
    if (row.code_hash !== sha256(code)) {
      await this.db.admin.query(`UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1`, [
        challengeId,
      ]);
      throw new AppException('invalid_credentials', { detail: 'Incorrect code' });
    }
    await this.db.admin.query(`UPDATE otp_challenges SET consumed_at = now() WHERE id = $1`, [
      challengeId,
    ]);
    return { tenantId: row.tenant_id, subjectType: row.subject_type, mobile: row.mobile };
  }
}
