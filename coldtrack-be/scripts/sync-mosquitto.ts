import { execFileSync } from 'node:child_process';
import { runLocal, syncBroker } from './mqtt-local.js';

await runLocal('--restart', async (db, restart) => {
  await syncBroker(db);
  if (restart) execFileSync('docker', ['compose', 'restart', 'mosquitto'], { stdio: 'inherit' });
});
