import { type PipeTransform } from '@nestjs/common';
import { type ZodType, type infer as ZodInfer } from 'zod';

/** Validates a handler argument against a Zod schema (ZodError maps to 422). */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): ZodInfer<T> {
    return this.schema.parse(value);
  }
}
