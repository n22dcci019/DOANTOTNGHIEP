import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'dotenv';
import pg from 'pg';

const envPath = fileURLToPath(new URL('../.env.local', import.meta.url));
const rootEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));
const seedMarker = 'coldtrack_step_1_8';
const accounts = [
  { key: 'DEMO_ADMIN', email: 'coldtrack.admin@example.test', name: 'Quản trị demo', role: 'admin' },
  ...[['customer', 'Khách demo', 3], ['driver', 'Tài xế demo', 5]].flatMap(([role, label, count]) =>
    Array.from({ length: Number(count) }, (_, index) => {
      const number = String(index + 1).padStart(2, '0');
      return {
        key: `DEMO_${String(role).toUpperCase()}_${number}`,
        email: `coldtrack.${role}.${number}@example.test`,
        name: `${label} ${number}`,
        role: String(role),
      };
    })),
];
const deviceCodes = ['SIM-01', 'SIM-02', 'SIM-03', 'SIM-04', 'CT-001'];

function readIfPresent(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function localUrl(value: string | undefined, name: string, protocols: string[], port: string, pathname: string) {
  if (!value) throw new Error(`${name} is required`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!protocols.includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.port !== port || url.pathname !== pathname || url.search || url.hash) {
    throw new Error(`${name} must target the DoAnTotNghiep local stack on port ${port}`);
  }
  return value;
}

function saveCredential(account: (typeof accounts)[number], password: string) {
  const emailKey = `${account.key}_EMAIL`;
  const passwordKey = `${account.key}_PASSWORD`;
  const contents = readIfPresent(envPath).split(/\r?\n/)
    .filter(line => !new RegExp(`^\\s*(?:export\\s+)?(?:${emailKey}|${passwordKey})\\s*=`).test(line))
    .join('\n').trimEnd();
  const tempPath = `${envPath}.seed-${randomUUID()}`;
  try {
    writeFileSync(tempPath, `${contents ? `${contents}\n` : ''}${emailKey}=${account.email}\n${passwordKey}=${password}\n`,
      { flag: 'wx', mode: 0o600 });
    renameSync(tempPath, envPath);
  } finally {
    rmSync(tempPath, { force: true });
  }
}

async function seed() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--reset-passwords')) {
    throw new Error('Usage: npm run db:seed [-- --reset-passwords]');
  }
  const resetPasswords = args.includes('--reset-passwords');
  const env = { ...parse(readIfPresent(rootEnvPath)), ...parse(readIfPresent(envPath)), ...process.env };
  const supabaseUrl = localUrl(env.SUPABASE_URL, 'SUPABASE_URL', ['http:', 'https:'], '54321', '/');
  const databaseUrl = localUrl(env.DATABASE_URL, 'DATABASE_URL', ['postgres:', 'postgresql:'], '54322', '/postgres');
  if (!env.SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY is required in the local environment');
  const supabase = createClient(supabaseUrl, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10000) }) },
  });
  const db = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, query_timeout: 15000 });
  try {
    await db.connect();
    // Serialize Auth and SQL work across seed processes. Session end releases the lock.
    await db.query('select pg_advisory_lock($1)', [182025]);
    const existing = await db.query<{ id: string; email: string; seed_marker: string | null }>(`
      select id, lower(email) as email, raw_app_meta_data->>'coldtrack_seed' as seed_marker
      from auth.users where lower(email) = any($1::text[])`, [accounts.map(account => account.email)]);
    for (const row of existing.rows) {
      if (row.seed_marker !== seedMarker) {
        throw new Error(`Demo email is already registered outside this seed (${row.email})`);
      }
    }

    const accountIds = new Map(existing.rows.map(row => [row.email, row.id]));
    for (const account of accounts) {
      const id = accountIds.get(account.email);
      if (id && !resetPasswords) continue;
      const password = randomBytes(24).toString('hex');
      const result = id
        ? await supabase.auth.admin.updateUserById(id, { password })
        : await supabase.auth.admin.createUser({ email: account.email, password, email_confirm: true,
          app_metadata: { coldtrack_seed: seedMarker } });
      if (result.error || !result.data.user) {
        throw new Error(`Auth Admin operation failed for ${account.key} (status ${result.error?.status ?? 'unknown'})`);
      }
      accountIds.set(account.email, result.data.user.id);
      // Save after Auth confirms the write. Existing accounts are never rotated implicitly.
      saveCredential(account, password);
    }

    await db.query('begin');
    try {
      await db.query('set local role service_role');
      const adminId = accountIds.get(accounts[0].email);
      for (const [index, account] of accounts.entries()) {
        const id = accountIds.get(account.email);
        await db.query(`insert into public.profiles (id, full_name, phone, email) values ($1, $2, $3, $4)
          on conflict (id) do nothing`, [id, account.name, `+1202555010${index}`, account.email]);
        const access = await db.query(`insert into public.account_access (user_id, role_id, status, activated_by, activated_at)
          values ($1, (select id from public.roles where code = $2), 'active', $3, now())
          on conflict (user_id) do nothing returning user_id`, [id, account.role, adminId]);
        if (access.rowCount === 0) {
          const current = await db.query(`select r.code, a.status from public.account_access a
            join public.roles r on r.id = a.role_id where a.user_id = $1`, [id]);
          if (current.rows[0]?.code !== account.role || current.rows[0]?.status !== 'active') {
            throw new Error(`Existing access for ${account.key} differs from the seed; it was left intact`);
          }
        }
      }

      for (const code of deviceCodes) {
        const plate = `DEMO-${code}`;
        await db.query(`insert into public.vehicles (plate, temp_capacity_min, temp_capacity_max, payload_kg, status)
          values ($1, -25, -15, 1000, 'active') on conflict (plate) do nothing`, [plate]);
        const vehicle = await db.query<{ id: string }>('select id from public.vehicles where plate = $1', [plate]);
        const vehicleId = vehicle.rows[0].id;
        const simulated = code.startsWith('SIM-');
        await db.query(`insert into public.devices (device_code, vehicle_id, is_simulated, status)
          values ($1, $2, $3, 'active') on conflict (device_code) do nothing`, [code, vehicleId, simulated]);
        const device = await db.query<{ id: string; is_simulated: boolean; vehicle_id: string | null }>(`
          select id, is_simulated, vehicle_id from public.devices where device_code = $1 for update`, [code]);
        const current = device.rows[0];
        if (current.is_simulated !== simulated || (current.vehicle_id && current.vehicle_id !== vehicleId)) {
          throw new Error(`Device ${code} already has a different configuration or vehicle`);
        }
        const open = await db.query<{ device_id: string; vehicle_id: string }>(`select device_id, vehicle_id
          from public.device_assignments where valid_to is null and (device_id = $1 or vehicle_id = $2)`, [current.id, vehicleId]);
        if (!open.rowCount) {
          await db.query('insert into public.device_assignments (device_id, vehicle_id, valid_from) values ($1, $2, now())',
            [current.id, vehicleId]);
        } else if (open.rowCount !== 1 || open.rows[0].device_id !== current.id || open.rows[0].vehicle_id !== vehicleId) {
          throw new Error(`Device ${code} or vehicle ${plate} has a different open assignment`);
        }
        if (current.vehicle_id === null) {
          await db.query('update public.devices set vehicle_id = $1 where id = $2', [vehicleId, current.id]);
        }
      }
      await db.query('commit');
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
    console.log('Demo seed ready: 9 accounts, 5 vehicles, 5 devices and 5 open assignments. Credentials are in .env.local.');
  } finally {
    await db.end();
  }
}

try {
  await seed();
} catch (error) {
  // Never print connection strings, PostgreSQL error detail or Auth response bodies.
  const message = error instanceof pg.DatabaseError ? `PostgreSQL operation failed (${error.code})`
    : error instanceof Error ? error.message : 'unknown error';
  console.error(`Demo seed failed: ${message}`);
  process.exitCode = 1;
}
