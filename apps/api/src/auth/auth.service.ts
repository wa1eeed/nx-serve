import { Injectable } from '@nestjs/common';
import { uuidv7 } from '@nxserve/domain';
import { DbService } from '../db/db.service.js';
import { AppException } from '../common/app-exception.js';
import { OtpService } from './otp.service.js';
import { PasswordService } from './password.service.js';
import { TotpService } from './totp.service.js';
import { TokenService, type TokenPair } from './token.service.js';
import {
  type MfaVerifyDto,
  type OtpRequestDto,
  type OtpVerifyDto,
  type RefreshDto,
  type StaffLoginDto,
} from './dto.js';

interface StaffRow {
  id: string;
  mfa_enabled: boolean;
  password_hash: string | null;
  mfa_secret: string | null;
}

export type StaffLoginResult = TokenPair | { mfa_required: true; mfa_token: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
    private readonly totp: TotpService,
  ) {}

  async requestOtp(tenantId: string, dto: OtpRequestDto): Promise<{ challenge_id: string }> {
    const challengeId = await this.otp.create(tenantId, dto.subject_type, dto.mobile);
    return { challenge_id: challengeId };
  }

  async verifyOtp(dto: OtpVerifyDto): Promise<TokenPair> {
    const { tenantId, subjectType, mobile } = await this.otp.verify(dto.challenge_id, dto.code);
    const subjectId =
      subjectType === 'customer'
        ? await this.upsertCustomer(tenantId, mobile)
        : await this.findAgent(tenantId, mobile);
    return this.tokens.issue({ type: subjectType, id: subjectId, tenantId });
  }

  async staffLogin(tenantId: string, dto: StaffLoginDto): Promise<StaffLoginResult> {
    const staff = await this.findStaff(tenantId, dto.email);
    const ok =
      staff?.password_hash != null && (await this.passwords.verify(dto.password, staff.password_hash));
    if (!staff || !ok) {
      throw new AppException('invalid_credentials');
    }
    if (staff.mfa_enabled) {
      return { mfa_required: true, mfa_token: await this.tokens.issueMfaToken(staff.id, tenantId) };
    }
    return this.tokens.issue({ type: 'staff', id: staff.id, tenantId });
  }

  async mfaVerify(dto: MfaVerifyDto): Promise<TokenPair> {
    const { staffId, tenantId } = await this.tokens.verifyMfaToken(dto.mfa_token);
    const res = await this.db.admin.query<{ mfa_secret: string | null }>(
      `SELECT mfa_secret FROM staff_credentials WHERE staff_user_id = $1`,
      [staffId],
    );
    const secret = res.rows[0]?.mfa_secret;
    if (!secret || !this.totp.verify(dto.code, secret)) {
      throw new AppException('invalid_credentials', { detail: 'Invalid MFA code' });
    }
    return this.tokens.issue({
      type: 'staff',
      id: staffId,
      ...(tenantId !== null ? { tenantId } : {}),
    });
  }

  refresh(dto: RefreshDto): Promise<TokenPair> {
    return this.tokens.rotate(dto.refresh_token);
  }

  async logout(dto: RefreshDto): Promise<void> {
    await this.tokens.revoke(dto.refresh_token);
  }

  private async upsertCustomer(tenantId: string, mobile: string): Promise<string> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO customers (id, tenant_id, mobile) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, mobile) DO UPDATE SET mobile = EXCLUDED.mobile
         RETURNING id`,
        [uuidv7(), tenantId, mobile],
      );
      return res.rows[0].id;
    });
  }

  private async findAgent(tenantId: string, mobile: string): Promise<string> {
    const id = await this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{ id: string }>(
        `SELECT id FROM provider_agents WHERE mobile = $1 AND is_active = true`,
        [mobile],
      );
      return res.rows[0]?.id ?? null;
    });
    if (!id) {
      throw new AppException('not_found', { detail: 'No active agent with this mobile' });
    }
    return id;
  }

  private async findStaff(tenantId: string, email: string): Promise<StaffRow | null> {
    const res = await this.db.admin.query<StaffRow>(
      `SELECT s.id, s.mfa_enabled, c.password_hash, c.mfa_secret
       FROM staff_users s LEFT JOIN staff_credentials c ON c.staff_user_id = s.id
       WHERE s.tenant_id = $1 AND s.email = $2 AND s.is_active = true`,
      [tenantId, email],
    );
    return res.rows[0] ?? null;
  }
}
