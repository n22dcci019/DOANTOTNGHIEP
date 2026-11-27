import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createSecret, readSecret, runLocal, secretPath, secureDirectory, services, syncBroker } from './mqtt-local.js';

await runLocal('--rotate', async (db, rotate) => {
  secureDirectory(dirname(secretPath(services[0])));
  for (const user of services) {
    const path = secretPath(user);
    if (rotate || !existsSync(path)) createSecret(user, path);
    else readSecret(user);
  }
  await syncBroker(db);
});
