import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(pbkdf2);
export const MOSQUITTO_HASH_ITERATIONS = 220000;

// mosquitto_passwd -H sha512-pbkdf2 -I 220000, without the username prefix.
export async function hashMosquittoCredential(password: string): Promise<string> {
  if (!password || password.includes('\0')) throw new Error('Credential must be nonempty and contain no NUL');
  const salt = randomBytes(64);
  const digest = await derive(password, salt, MOSQUITTO_HASH_ITERATIONS, 64, 'sha512');
  return `$7$${MOSQUITTO_HASH_ITERATIONS}$${salt.toString('base64')}$${digest.toString('base64')}`;
}

export async function matchesMosquittoHash(password: string, hash: string): Promise<boolean> {
  const match = /^\$7\$(\d{1,7})\$([A-Za-z0-9+/]{16}|[A-Za-z0-9+/]{86}==)\$([A-Za-z0-9+/]{86}==)$/.exec(hash);
  if (!match || Number(match[1]) < 1) return false;
  const actual = await derive(password, Buffer.from(match[2], 'base64'), Number(match[1]), 64, 'sha512');
  return timingSafeEqual(actual, Buffer.from(match[3], 'base64'));
}
