import { pbkdf2, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(pbkdf2);
export const MOSQUITTO_HASH_ITERATIONS = 220000;

// mosquitto_passwd -H sha512-pbkdf2 -I 220000, without the username prefix.
// No provisioning, persistence or broker password-file writes happen here.
export async function hashMosquittoCredential(password: string): Promise<string> {
  if (!password || password.includes('\0')) throw new Error('Credential must be nonempty and contain no NUL');
  const salt = randomBytes(64);
  const digest = await derive(password, salt, MOSQUITTO_HASH_ITERATIONS, 64, 'sha512');
  return `$7$${MOSQUITTO_HASH_ITERATIONS}$${salt.toString('base64')}$${digest.toString('base64')}`;
}
