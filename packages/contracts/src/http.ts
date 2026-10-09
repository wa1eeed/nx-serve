import { z } from 'zod';

/** HTTP conventions shared by every endpoint (ADR-0008, docs/11). */

export const HEADERS = {
  idempotencyKey: 'Idempotency-Key',
  requestId: 'X-Request-Id',
  rateLimitLimit: 'RateLimit-Limit',
  rateLimitRemaining: 'RateLimit-Remaining',
  rateLimitReset: 'RateLimit-Reset',
  retryAfter: 'Retry-After',
  acceptLanguage: 'Accept-Language',
} as const;

export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const LocaleSchema = z.enum(LOCALES);

/** Cursor pagination query parameters. */
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  starting_after: z.string().optional(),
  ending_before: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** Cursor pagination response envelope. */
export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
  });
}

/** Translatable text stored as JSON (docs/04 rule 3b, ADR-0013). */
export const TranslatableTextSchema = z
  .object({ en: z.string() })
  .catchall(z.string())
  .describe('Translatable text keyed by locale; en is the source and required.');
export type TranslatableText = z.infer<typeof TranslatableTextSchema>;

/** A monetary amount as integer minor units plus an ISO 4217 currency. */
export const MoneySchema = z.object({
  amount_minor: z.string().regex(/^-?\d+$/, 'amount_minor is an integer serialised as a string'),
  currency: z.string().length(3),
});
export type MoneyDto = z.infer<typeof MoneySchema>;
