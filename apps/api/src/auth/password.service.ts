import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { argon2Verify, argon2id } from 'hash-wasm';

/** Password hashing with argon2id (docs/18). */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2id({
      password,
      salt: randomBytes(16),
      parallelism: 1,
      iterations: 3,
      memorySize: 65_536,
      hashLength: 32,
      outputType: 'encoded',
    });
  }

  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2Verify({ password, hash });
    } catch {
      return false;
    }
  }
}
