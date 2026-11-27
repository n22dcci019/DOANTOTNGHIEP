import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { sql, type Transaction } from 'kysely';
import { DATABASE, type Database } from '../../../../libs/database/database.module.js';
import type { DB } from '../../../../libs/database/schema.js';
import { asService } from '../../../../libs/api/auth.js';
import { ApiError, assertVersion } from '../../../../libs/api/errors.js';
import { EMAIL_SENDER, type EmailSender } from '../../../../libs/email/email-sender.js';
import type { AcceptInvitationDto, InviteDto, UpdateProfileDto } from './accounts.dto.js';

export const invitationHash = (token: string) => createHash('sha256').update(token).digest('hex');
const isUniqueConflict = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  private authClient?: SupabaseClient;
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly config: ConfigService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  private auth(): SupabaseClient {
    return this.authClient ??= createClient(this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.get<string>('SUPABASE_SECRET_KEY') || this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10000) }) },
      });
  }

  private audit(tx: Transaction<DB>, action: string, entity: string, id: string, actor: string, payload: Record<string, string | number>) {
    return tx.insertInto('audit_logs').values({
      action, entity, entity_id: id, actor_id: actor, payload, created_at: new Date(),
    }).execute();
  }

  async updateProfile(userId: string, body: UpdateProfileDto) {
    try {
      return await asService(this.db, async tx => {
        const profile = await tx.selectFrom('profiles').selectAll().where('id', '=', userId).executeTakeFirst();
        if (!profile) throw new ApiError('NOT_FOUND');
        assertVersion(profile, body.version);
        if (body.email !== undefined) {
          const duplicate = await tx.selectFrom('profiles').select('id').where(sql<boolean>`lower(email) = ${body.email.toLowerCase()}`)
            .where('id', '!=', userId).executeTakeFirst();
          if (duplicate) throw new ApiError('CONFLICT');
        }
        const updated = await tx.updateTable('profiles').set({
          ...(body.full_name !== undefined ? { full_name: body.full_name } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          version: sql<number>`version + 1`,
        }).where('id', '=', userId).where('version', '=', body.version).returningAll().executeTakeFirst();
        if (!updated) {
          const current = await tx.selectFrom('profiles').select('version').where('id', '=', userId).executeTakeFirstOrThrow();
          throw new ApiError('VERSION_CONFLICT', { current_version: current.version });
        }
        await this.audit(tx, 'profiles.update', 'profiles', userId, userId, { version: updated.version });
        return updated;
      });
    } catch (error) {
      if (isUniqueConflict(error)) throw new ApiError('CONFLICT');
      throw error;
    }
  }

  async invite(actor: string, actorRole: string, body: InviteDto) {
    // Defense in depth: an accidental permission grant must not allow a non-admin
    // to mint an admin invitation.
    if (body.role_code === 'admin' && actorRole !== 'admin') throw new ApiError('FORBIDDEN');
    const token = randomBytes(32).toString('base64url');
    const invitation = await asService(this.db, async tx => {
      const role = await tx.selectFrom('roles').select('id').where('code', '=', body.role_code).executeTakeFirstOrThrow();
      const row = await tx.insertInto('account_invitations').values({
        token_hash: invitationHash(token), email: body.email, role_id: role.id, created_by: actor,
        expires_at: sql<Date>`now() + interval '72 hours'`,
      }).returning(['id', 'expires_at']).executeTakeFirstOrThrow();
      await this.audit(tx, 'account.invite', 'account_invitations', row.id, actor, { role_code: body.role_code });
      const link = new URL('/invitations/accept', this.config.get<string>('INVITATION_ACCEPT_URL') ?? 'http://localhost:5173');
      link.searchParams.set('token', token);
      await this.email.send({ to: body.email, subject: 'Lời mời tham gia ColdTrack', text: `Đăng ký tài khoản qua liên kết (hết hạn sau 72 giờ): ${link.href}` });
      return row;
    });
    const expose = this.config.get<string>('NODE_ENV') === 'test' && this.config.get<string>('EXPOSE_INVITE_TOKEN_FOR_TEST') === 'true';
    return { ...invitation, ...(expose ? { token } : {}) };
  }

  async accept(body: AcceptInvitationDto, requestId: string) {
    const hash = invitationHash(body.token);
    // GoTrue can return a generic 500 when two createUser calls race on the same
    // email. Serialize the whole accept attempt across API processes using a
    // session advisory lock, without starting the business transaction before
    // Auth creation. FOR UPDATE below remains the authoritative one-use check.
    // Reuse this same connection for DB work to avoid pool starvation by waiters.
    return this.db.connection().execute(async connection => {
      const deadline = Date.now() + 15000;
      let acquired = false;
      try {
        while (!acquired) {
          const result = await sql<{ acquired: boolean }>`select pg_try_advisory_lock(hashtextextended(${hash}, 22)) as acquired`.execute(connection);
          acquired = result.rows[0].acquired;
          if (!acquired) {
            if (Date.now() >= deadline) throw new ApiError('NOT_FOUND');
            await delay(25);
          }
        }
        return await this.acceptLocked(connection, body, requestId, hash);
      } finally {
        if (acquired) await sql`select pg_advisory_unlock(hashtextextended(${hash}, 22))`.execute(connection);
      }
    });
  }

  private async acceptLocked(db: Database, body: AcceptInvitationDto, requestId: string, hash: string) {
    // Read only what is needed for Auth creation. The authoritative check is
    // repeated under FOR UPDATE after creating the Auth user, as agreed in 2.2.
    const invitation = await asService(db, tx => tx.selectFrom('account_invitations').selectAll()
      .where('token_hash', '=', hash).where('used_at', 'is', null).where('revoked_at', 'is', null)
      .where('expires_at', '>', sql<Date>`clock_timestamp()`).executeTakeFirst());
    if (!invitation) throw new ApiError('NOT_FOUND');
    let created;
    try {
      created = await this.auth().auth.admin.createUser({ email: invitation.email, password: body.password, email_confirm: true });
    } catch {
      this.logger.error(`[${requestId}] Auth user creation failed`);
      throw new ApiError('INTERNAL');
    }
    if (created.error || !created.data.user) {
      // Auth's unique email constraint also prevents concurrent accept attempts
      // from creating two users. Do not expose registration/token state.
      if (created.error?.code === 'email_exists') throw new ApiError('NOT_FOUND');
      this.logger.error(`[${requestId}] Auth user creation failed`);
      throw new ApiError('INTERNAL');
    }
    const userId = created.data.user.id;
    try {
      return await asService(db, async tx => {
        const locked = await tx.selectFrom('account_invitations').selectAll().where('id', '=', invitation.id).forUpdate().executeTakeFirst();
        if (!locked || locked.used_at || locked.revoked_at) throw new ApiError('NOT_FOUND');
        const valid = await tx.selectFrom('account_invitations').select('id').where('id', '=', locked.id)
          .where('expires_at', '>', sql<Date>`clock_timestamp()`).executeTakeFirst();
        if (!valid) throw new ApiError('NOT_FOUND');
        await tx.insertInto('profiles').values({ id: userId, full_name: body.full_name, email: locked.email }).execute();
        await tx.insertInto('account_access').values({
          user_id: userId, role_id: locked.role_id, status: 'active', activated_by: locked.created_by, activated_at: new Date(),
        }).execute();
        await tx.updateTable('account_invitations').set({ used_at: new Date(), used_by: userId }).where('id', '=', locked.id).execute();
        await this.audit(tx, 'account.invitation.accept', 'account_invitations', locked.id, userId, { user_id: userId });
        return { user_id: userId, status: 'active' };
      });
    } catch (error) {
      this.logger.warn(`[${requestId}] Invitation DB transaction failed; compensating Auth user_id=${userId}`);
      try {
        const deleted = await this.auth().auth.admin.deleteUser(userId);
        if (deleted.error) throw deleted.error;
      } catch {
        this.logger.error(`[${requestId}] Auth compensation failed; manual cleanup required user_id=${userId}`);
        throw new ApiError('INTERNAL');
      }
      if (isUniqueConflict(error)) throw new ApiError('CONFLICT');
      // Prevent SQL errors containing registration data from entering generic logs.
      if (error instanceof ApiError) throw error;
      this.logger.error(`[${requestId}] Invitation DB transaction failed; Auth compensation completed user_id=${userId}`);
      throw new ApiError('INTERNAL');
    }
  }

  async setStatus(actor: string, userId: string, status: 'active' | 'suspended') {
    if (status === 'suspended' && actor === userId) throw new ApiError('UNPROCESSABLE');
    return asService(this.db, async tx => {
      const updated = await tx.updateTable('account_access').set({
        status, version: sql<number>`version + 1`,
        ...(status === 'active' ? { activated_by: actor, activated_at: new Date() } : {}),
      }).where('user_id', '=', userId).returning(['user_id', 'status', 'version']).executeTakeFirst();
      if (!updated) throw new ApiError('NOT_FOUND');
      await this.audit(tx, status === 'active' ? 'account.activate' : 'account.suspend', 'account_access', userId, actor, { status });
      return updated;
    });
  }
}
