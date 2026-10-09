import { z } from 'zod';
import {
  type ErrorCode,
  ERROR_CODES,
  defaultTitleForCode,
  httpStatusForCode,
} from './codes.js';

/** A single field level validation error. */
export const ProblemFieldErrorSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
});
export type ProblemFieldError = z.infer<typeof ProblemFieldErrorSchema>;

/**
 * RFC 9457 problem+json body. `code` is a stable NX error code; `type` is a URI
 * pointing at the documented error. `request_id` ties the error to logs.
 */
export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.enum(Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]]),
  errors: z.array(ProblemFieldErrorSchema).optional(),
  request_id: z.string().optional(),
  required_plan: z.string().optional(),
  required_module: z.string().optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export interface BuildProblemOptions {
  detail?: string;
  errors?: ProblemFieldError[];
  requestId?: string;
  requiredPlan?: string;
  requiredModule?: string;
  typeBaseUrl?: string;
}

/** Builds a problem+json body from a stable error code. */
export function buildProblem(code: ErrorCode, options: BuildProblemOptions = {}): Problem {
  const base = options.typeBaseUrl ?? 'https://errors.nxserve.dev';
  const problem: Problem = {
    type: `${base}/${code}`,
    title: defaultTitleForCode(code),
    status: httpStatusForCode(code),
    code,
  };
  if (options.detail !== undefined) problem.detail = options.detail;
  if (options.errors !== undefined) problem.errors = options.errors;
  if (options.requestId !== undefined) problem.request_id = options.requestId;
  if (options.requiredPlan !== undefined) problem.required_plan = options.requiredPlan;
  if (options.requiredModule !== undefined) problem.required_module = options.requiredModule;
  return problem;
}
