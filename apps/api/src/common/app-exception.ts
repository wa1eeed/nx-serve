import { type ErrorCode, type ProblemFieldError } from '@nxserve/contracts';

export interface AppExceptionOptions {
  detail?: string;
  errors?: ProblemFieldError[];
  requiredPlan?: string;
  requiredModule?: string;
}

/** An error carrying a stable problem+json code, thrown by application code. */
export class AppException extends Error {
  readonly code: ErrorCode;
  readonly options: AppExceptionOptions;

  constructor(code: ErrorCode, options: AppExceptionOptions = {}) {
    super(options.detail ?? code);
    this.name = 'AppException';
    this.code = code;
    this.options = options;
  }
}
