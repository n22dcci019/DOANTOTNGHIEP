import { Inject, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { sql, type Transaction } from 'kysely';
import { DATABASE, type Database } from '../database/database.module.js';
import type { DB } from '../database/schema.js';
import { ApiError, type ApiRequest } from './errors.js';
import { JwtVerifier } from './jwt-verifier.js';

const PUBLIC = Symbol('public');
const PERMISSIONS = Symbol('permissions');
export const Public = () => SetMetadata(PUBLIC, true);
export const RequirePermission = (...codes: string[]) => SetMetadata(PERMISSIONS, codes);

// DATABASE_URL is a server login with membership in service_role. Never use a
// caller's JWT to authorize these queries; SET LOCAL is confined to this transaction.
export function asService<T>(db: Database, run: (tx: Transaction<DB>) => Promise<T>): Promise<T> {
  return db.transaction().execute(async tx => {
    await sql`set local role service_role`.execute(tx);
    return run(tx);
  });
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly verifier: JwtVerifier,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;
    const req = context.switchToHttp().getRequest<ApiRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') ?? '');
    if (!match) throw new ApiError('UNAUTHENTICATED');
    let userId: string;
    try {
      const { payload } = await this.verifier.verify(match[1]);
      if (typeof payload.sub !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)) {
        throw new Error('Invalid subject');
      }
      userId = payload.sub;
    } catch {
      throw new ApiError('UNAUTHENTICATED');
    }
    const account = await asService(this.db, async tx => {
      const access = await tx.selectFrom('account_access as a')
        .innerJoin('roles as r', 'r.id', 'a.role_id')
        .select(['a.status', 'a.role_id', 'r.code'])
        .where('a.user_id', '=', userId).executeTakeFirst();
      if (!access || access.status !== 'active') throw new ApiError('ACCOUNT_INACTIVE');
      const permissions = await tx.selectFrom('role_permissions as rp')
        .innerJoin('permissions as p', 'p.id', 'rp.permission_id')
        .select('p.code').where('rp.role_id', '=', access.role_id).execute();
      return { userId, roleCode: access.code, permissions: permissions.map(p => p.code) };
    });
    req.principal = account;
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS, targets) ?? [];
    if (!required.every(code => account.permissions.includes(code))) throw new ApiError('FORBIDDEN');
    return true;
  }
}
