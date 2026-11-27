import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

export const errorStatus = {
  VALIDATION_FAILED: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403,
  ACCOUNT_INACTIVE: 403, NOT_FOUND: 404, VERSION_CONFLICT: 409,
  IDEMPOTENCY_KEY_REQUIRED: 400, IDEMPOTENCY_KEY_REUSED: 409,
  IDEMPOTENCY_IN_PROGRESS: 409, UNPROCESSABLE: 422, INTERNAL: 500,
} as const;
export type ErrorCode = keyof typeof errorStatus;
const messages: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Invalid request.', UNAUTHENTICATED: 'Authentication required.',
  FORBIDDEN: 'Permission denied.', ACCOUNT_INACTIVE: 'Account is not active.',
  NOT_FOUND: 'Resource not found.', VERSION_CONFLICT: 'Resource version has changed.',
  IDEMPOTENCY_KEY_REQUIRED: 'Idempotency-Key is required.',
  IDEMPOTENCY_KEY_REUSED: 'Idempotency-Key was used for a different request.',
  IDEMPOTENCY_IN_PROGRESS: 'Request is already in progress.',
  UNPROCESSABLE: 'Request cannot be processed.', INTERNAL: 'An internal error occurred.',
};

export class ApiError extends HttpException {
  constructor(readonly code: ErrorCode, readonly details: { current_version: number } | null = null) {
    super(messages[code], errorStatus[code]);
  }
}

export interface ApiRequest extends Request {
  requestId: string;
  principal?: { userId: string; roleCode: string; permissions: string[] };
}

export function requestId(req: Request, res: Response, next: () => void) {
  const id = req.get('X-Request-Id') || randomUUID();
  (req as ApiRequest).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<ApiRequest>();
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const fallback: Partial<Record<number, ErrorCode>> = {
      400: 'VALIDATION_FAILED', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN',
      404: 'NOT_FOUND', 409: 'VERSION_CONFLICT', 422: 'UNPROCESSABLE',
    };
    const code = exception instanceof ApiError ? exception.code : fallback[status] ?? 'INTERNAL';
    if (code === 'INTERNAL') {
      this.logger.error(`[${req.requestId}] ${exception instanceof Error ? exception.stack : String(exception)}`);
    }
    res.status(errorStatus[code]).json({ error: {
      code, message: messages[code],
      details: exception instanceof ApiError ? exception.details : null,
      request_id: req.requestId,
    } });
  }
}

export function assertVersion(entity: { version: number }, expectedVersion: number): void {
  if (entity.version !== expectedVersion) {
    throw new ApiError('VERSION_CONFLICT', { current_version: entity.version });
  }
}
