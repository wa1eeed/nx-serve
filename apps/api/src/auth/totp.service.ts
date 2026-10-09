import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';

/** Time based one time passwords for mandatory admin MFA (docs/18). */
@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  keyUri(account: string, issuer: string, secret: string): string {
    return authenticator.keyuri(account, issuer, secret);
  }

  verify(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }
}
