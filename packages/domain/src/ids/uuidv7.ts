import { randomBytes } from 'node:crypto';

/**
 * Generates a UUIDv7 (RFC 9562): a 48-bit Unix millisecond timestamp, a 12-bit
 * monotonic sequence within the same millisecond, and random bits. Time ordered
 * so it is index friendly as a primary key, generated in the application per
 * ADR-0007 and docs/04.
 */
let lastMs = -1;
let sequence = 0;

export function uuidv7(now: number = Date.now()): string {
  const buf = randomBytes(16);

  if (now === lastMs) {
    sequence = (sequence + 1) & 0x0fff;
    // On the rare overflow within one millisecond, borrow from the next ms so
    // ordering is preserved.
    if (sequence === 0) {
      now += 1;
      lastMs = now;
    }
  } else {
    lastMs = now;
    sequence = ((buf.readUInt8(6) & 0x0f) << 8) | buf.readUInt8(7);
  }

  // 48-bit big endian timestamp in the first six bytes.
  buf.writeUIntBE(now, 0, 6);
  // Byte 6: version (0b0111) in the high nibble, sequence high bits in the low nibble.
  buf.writeUInt8(0x70 | ((sequence >> 8) & 0x0f), 6);
  // Byte 7: sequence low bits.
  buf.writeUInt8(sequence & 0xff, 7);
  // Byte 8: RFC 4122 variant (0b10) in the top two bits.
  buf.writeUInt8((buf.readUInt8(8) & 0x3f) | 0x80, 8);

  const hex = buf.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** True for any well formed UUID string. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** True for a well formed UUID whose version nibble is 7. */
export function isUuidv7(value: string): boolean {
  return isUuid(value) && value[14] === '7';
}
