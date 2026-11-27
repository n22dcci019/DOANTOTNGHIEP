import { existsSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashMosquittoCredential, matchesMosquittoHash } from '../libs/credentials/mosquitto-hash.js';
import { assertSim, createSecret, readSecret, runLocal, secretPath, secureDirectory, syncBroker } from './mqtt-local.js';

await runLocal('--rotate', async (db, rotate) => {
  const devices = (await db.query<{ id: string; device_code: string }>(
    'select id, device_code from public.devices where is_simulated order by device_code')).rows;
  devices.forEach(d => assertSim(d.device_code));
  secureDirectory(dirname(secretPath('SIM-01')));
  for (const { id, device_code: code } of devices) {
    const path = secretPath(code);
    const pending = path + '.pending';
    await db.query('begin');
    try {
      await db.query('select id from public.devices where id = $1 for update', [id]);
      const credentials = (await db.query<{ credential_hash: string; active: boolean; revoked_at: Date | null }>(
        'select credential_hash, active, revoked_at from public.device_credentials where device_id = $1 for update', [id])).rows;
      const current = credentials.find(c => c.active && !c.revoked_at);
      // Recover a committed rotation whose final rename was interrupted.
      if (current && existsSync(pending) && await matchesMosquittoHash(readSecret(code, pending), current.credential_hash)) {
        renameSync(pending, path);
      }
      if (!rotate && current) {
        if (!existsSync(path) || !await matchesMosquittoHash(readSecret(code), current.credential_hash)) {
          throw new Error(`Missing or mismatched secret for ${code}. Use --rotate to replace it.`);
        }
      } else if (rotate || !credentials.length) {
        // On a fresh DB reset, restore a previously issued local secret without overwriting it.
        const reuse = !rotate && existsSync(path);
        const password = reuse ? readSecret(code) : createSecret(code, pending);
        const hash = await hashMosquittoCredential(password);
        await db.query(`update public.device_credentials set active = false, revoked_at = coalesce(revoked_at, now())
          where device_id = $1 and active`, [id]);
        await db.query(`insert into public.device_credentials (device_id, credential_hash, active, provisioning_status)
          values ($1, $2, true, 'provisioned')`, [id, hash]);
        await db.query('commit');
        if (!reuse) renameSync(pending, path);
        continue;
      }
      // A recorded revocation always wins over the local secret until an explicit rotation.
      await db.query('commit');
      rmSync(pending, { force: true });
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
  }
  await syncBroker(db, true);
});
