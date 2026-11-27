import { Inject, Injectable, Logger, SetMetadata, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { defer, lastValueFrom, type Observable } from 'rxjs';
import type { Response } from 'express';
import { DATABASE, type Database } from '../database/database.module.js';
import { asService } from './auth.js';
import { ApiError, type ApiRequest } from './errors.js';

const IDEMPOTENT = Symbol('idempotent');
export const Idempotent = () => SetMetadata(IDEMPOTENT, true);

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  constructor(@Inject(DATABASE) private readonly db: Database, private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<ApiRequest>();
    if (!this.reflector.getAllAndOverride<boolean>(IDEMPOTENT, [context.getHandler(), context.getClass()]) ||
        !['POST', 'PATCH', 'DELETE'].includes(req.method)) return next.handle();
    return defer(async () => {
      const key = req.get('Idempotency-Key');
      if (!key) throw new ApiError('IDEMPOTENCY_KEY_REQUIRED');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) throw new ApiError('VALIDATION_FAILED');
      if (!req.principal) throw new ApiError('UNAUTHENTICATED');
      const userId = req.principal.userId;
      const normalizedKey = key.toLowerCase();
      const operation = `${req.method} ${req.path}`;
      const hash = createHash('sha256').update(canonicalJson(req.body)).digest('hex');
      const res = context.switchToHttp().getResponse<Response>();
      const claim = await asService(this.db, async tx => {
        // The existing unique(user_id,key) arbitrates concurrent requests across
        // processes. Expired rows are replaced atomically, without a delete gap.
        const inserted = await tx.insertInto('idempotency_requests').values({
          user_id: userId, idempotency_key: normalizedKey, operation, payload_hash: hash,
          expires_at: sql<Date>`now() + interval '24 hours'`,
        }).onConflict(oc => oc.columns(['user_id', 'idempotency_key']).doUpdateSet({
          operation, payload_hash: hash, response: null, status_code: null,
          created_at: sql<Date>`now()`, expires_at: sql<Date>`now() + interval '24 hours'`,
        }).where('idempotency_requests.expires_at', '<=', sql<Date>`now()`))
          // Preserve PostgreSQL microseconds in the ownership marker. A JS Date
          // would truncate them and fail to match when saving/removing this row.
          .returningAll().returning(sql<string>`created_at::text`.as('claim_created_at')).executeTakeFirst();
        if (inserted) return { owned: true as const, row: inserted };
        const row = await tx.selectFrom('idempotency_requests').selectAll()
          .where('user_id', '=', userId).where('idempotency_key', '=', normalizedKey).executeTakeFirstOrThrow();
        return { owned: false as const, row };
      });
      if (!claim.owned) {
        if (claim.row.payload_hash !== hash || claim.row.operation !== operation) throw new ApiError('IDEMPOTENCY_KEY_REUSED');
        if (claim.row.status_code === null) throw new ApiError('IDEMPOTENCY_IN_PROGRESS');
        res.status(claim.row.status_code);
        return claim.row.response;
      }
      try {
        const response: unknown = await lastValueFrom(next.handle());
        await asService(this.db, tx => tx.updateTable('idempotency_requests')
          .set({ response: sql`${JSON.stringify(response ?? null)}::jsonb`, status_code: res.statusCode })
          .where('id', '=', claim.row.id).where('created_at', '=', sql<Date>`${claim.row.claim_created_at}::timestamptz`).execute());
        return response;
      } catch (error) {
        this.logger.error(`[${req.requestId}] Idempotent handler failed: ${error instanceof Error ? error.stack : String(error)}`);
        try {
          await asService(this.db, tx => tx.deleteFrom('idempotency_requests')
            .where('id', '=', claim.row.id).where('created_at', '=', sql<Date>`${claim.row.claim_created_at}::timestamptz`)
            .where('status_code', 'is', null).execute());
        } catch (cleanupError) {
          this.logger.error(`[${req.requestId}] Placeholder cleanup failed: ${String(cleanupError)}`);
        }
        throw error;
      }
    });
  }
}
