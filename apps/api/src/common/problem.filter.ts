import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { type FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import {
  type ErrorCode,
  PROBLEM_CONTENT_TYPE,
  buildProblem,
  httpStatusForCode,
} from '@nxserve/contracts';
import { DomainError } from '@nxserve/domain';
import { AppException } from './app-exception.js';
import { getContext } from '../context/request-context.js';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: 'malformed_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  415: 'unsupported_media_type',
  422: 'validation_error',
  429: 'rate_limited',
  500: 'internal_error',
  501: 'not_implemented',
  503: 'service_unavailable',
};

/** Maps every error to an RFC 9457 problem+json body with a stable code. */
@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const requestId = getContext()?.requestId;

    let code: ErrorCode = 'internal_error';
    let detail: string | undefined;
    let errors: { field: string; code: string; message: string }[] | undefined;
    let requiredPlan: string | undefined;
    let requiredModule: string | undefined;

    if (exception instanceof AppException) {
      code = exception.code;
      detail = exception.options.detail;
      errors = exception.options.errors;
      requiredPlan = exception.options.requiredPlan;
      requiredModule = exception.options.requiredModule;
    } else if (exception instanceof ZodError) {
      code = 'validation_error';
      errors = exception.issues.map((i) => ({
        field: i.path.join('.'),
        code: i.code,
        message: i.message,
      }));
    } else if (exception instanceof HttpException) {
      code = STATUS_TO_CODE[exception.getStatus()] ?? 'internal_error';
      detail = exception.message;
    } else if (exception instanceof DomainError) {
      code = 'validation_error';
      detail = exception.message;
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const problem = buildProblem(code, {
      ...(detail !== undefined ? { detail } : {}),
      ...(errors !== undefined ? { errors } : {}),
      ...(requestId !== undefined ? { requestId } : {}),
      ...(requiredPlan !== undefined ? { requiredPlan } : {}),
      ...(requiredModule !== undefined ? { requiredModule } : {}),
    });

    void reply
      .status(httpStatusForCode(code))
      .header('content-type', PROBLEM_CONTENT_TYPE)
      .send(problem);
  }
}
