import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ZodValidationPipe } from './zod.pipe.js';
import { OtpRequestSchema, StaffLoginSchema } from '../auth/dto.js';

describe('ZodValidationPipe', () => {
  it('returns the parsed value for valid input', () => {
    const pipe = new ZodValidationPipe(OtpRequestSchema);
    expect(pipe.transform({ mobile: '+966500000000', subject_type: 'customer' })).toEqual({
      mobile: '+966500000000',
      subject_type: 'customer',
    });
  });

  it('throws a ZodError for invalid input (maps to 422 at the boundary)', () => {
    const pipe = new ZodValidationPipe(OtpRequestSchema);
    expect(() => pipe.transform({ mobile: 'x', subject_type: 'driver' })).toThrow(ZodError);
  });

  it('rejects a bad staff login payload', () => {
    const result = StaffLoginSchema.safeParse({ email: 'not-an-email', password: 'short' });
    expect(result.success).toBe(false);
  });
});
