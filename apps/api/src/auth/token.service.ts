import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { uuidv7 } from '@nxserve/domain';
import { ConfigService } from '../config/config.service.js';
import { DbService } from '../db/db.service.js';
import { AppException } from '../common/app-exception.js';
import { type ActorType } from '../context/request-context.js';

export interface TokenSubject {
  type: ActorType;
  id: string;
  tenantId?: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

interface RefreshRow {
  id: string;
  tenant_id: string | null;
  subject_type: ActorType;
  subject_id: string;
  family_id: string;
  revoked_at: Date | null;
  used_at: Date | null;
  expires_at: Date;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Issues short lived access JWTs and opaque rotating refresh tokens with reuse
 * detection (docs/18). Refresh tokens are stored hashed; presenting a token that
 * was already rotated revokes the whole family.
 */
@Injectable()
export class TokenService {
  private readonly accessKey: Uint8Array;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DbService,
  ) {
    this.accessKey = new TextEncoder().encode(config.jwtAccessSecret);
  }

  async issue(subject: TokenSubject): Promise<TokenPair> {
    return this.issueForFamily(subject, uuidv7(), null);
  }

  /** Issues a short lived MFA challenge token carrying the staff id. */
  async issueMfaToken(staffId: string, tenantId: string | undefined): Promise<string> {
    return new SignJWT({ purpose: 'mfa', tid: tenantId ?? null })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(staffId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(this.accessKey);
  }

  async verifyMfaToken(token: string): Promise<{ staffId: string; tenantId: string | null }> {
    try {
      const { payload } = await jwtVerify(token, this.accessKey);
      if (payload.purpose !== 'mfa' || typeof payload.sub !== 'string') {
        throw new AppException('unauthorized');
      }
      return { staffId: payload.sub, tenantId: (payload.tid as string | null) ?? null };
    } catch {
      throw new AppException('unauthorized', { detail: 'Invalid MFA token' });
    }
  }

  async rotate(rawRefresh: string): Promise<TokenPair> {
    const tokenHash = sha256(rawRefresh);
    const row = await this.findByHash(tokenHash);
    if (!row || row.revoked_at || row.expires_at.getTime() < Date.now()) {
      throw new AppException('unauthorized', { detail: 'Invalid refresh token' });
    }
    if (row.used_at) {
      // Reuse detected: revoke the entire token family.
      await this.db.admin.query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`,
        [row.family_id],
      );
      throw new AppException('unauthorized', { detail: 'Refresh token reuse detected' });
    }
    await this.db.admin.query(`UPDATE refresh_tokens SET used_at = now() WHERE id = $1`, [row.id]);
    const subject: TokenSubject = {
      type: row.subject_type,
      id: row.subject_id,
      ...(row.tenant_id !== null ? { tenantId: row.tenant_id } : {}),
    };
    return this.issueForFamily(subject, row.family_id, row.id);
  }

  async revoke(rawRefresh: string): Promise<void> {
    await this.db.admin.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [sha256(rawRefresh)],
    );
  }

  private async issueForFamily(
    subject: TokenSubject,
    familyId: string,
    parentId: string | null,
  ): Promise<TokenPair> {
    const accessToken = await new SignJWT({ typ: subject.type, tid: subject.tenantId ?? null })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject.id)
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessTtlSeconds}s`)
      .sign(this.accessKey);

    const rawRefresh = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.config.refreshTtlSeconds * 1000);
    await this.db.admin.query(
      `INSERT INTO refresh_tokens (id, tenant_id, subject_type, subject_id, token_hash, family_id, parent_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uuidv7(), subject.tenantId ?? null, subject.type, subject.id, sha256(rawRefresh), familyId, parentId, expiresAt],
    );

    return {
      access_token: accessToken,
      refresh_token: rawRefresh,
      token_type: 'Bearer',
      expires_in: this.config.accessTtlSeconds,
    };
  }

  private async findByHash(tokenHash: string): Promise<RefreshRow | null> {
    const res = await this.db.admin.query<RefreshRow>(
      `SELECT id, tenant_id, subject_type, subject_id, family_id, revoked_at, used_at, expires_at
       FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
    return res.rows[0] ?? null;
  }
}
