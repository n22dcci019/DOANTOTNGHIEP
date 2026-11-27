import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';

// Token headers never configure verification policy. The resolver selects only
// a key; jwtVerify enforces this fixed algorithm allowlist before resolving it.
const ALGORITHMS = ['ES256', 'HS256'];
const JWKS_REFRESH_INTERVAL = 60_000;

@Injectable()
export class JwtVerifier {
  private readonly issuer: string;
  private readonly secret?: Uint8Array;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(config: ConfigService) {
    const url = new URL(config.getOrThrow<string>('SUPABASE_URL'));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('SUPABASE_URL must be an HTTP(S) URL without credentials, query or fragment');
    }
    this.issuer = `${url.href.replace(/\/+$/, '')}/auth/v1`;
    const secret = config.get<string>('SUPABASE_JWT_SECRET');
    if (secret?.trim()) this.secret = new TextEncoder().encode(secret);
    let lastAttempt = -Infinity;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`), {
      cooldownDuration: JWKS_REFRESH_INTERVAL,
      cacheMaxAge: 600_000,
      timeoutDuration: 3_000,
      [customFetch]: async (input, init) => {
        // Also throttle failed fetches: an unavailable endpoint must not cause
        // one outgoing request per incoming token. jose coalesces concurrent loads.
        const now = Date.now();
        if (now - lastAttempt < JWKS_REFRESH_INTERVAL) throw new Error('JWKS refresh is cooling down');
        lastAttempt = now;
        return fetch(input, init);
      },
    });
  }

  async verify(token: string) {
    return jwtVerify(token, async (header, jwt) => {
      if (header.alg === 'HS256' && this.secret) return this.secret;
      if (header.alg === 'ES256' && typeof header.kid === 'string' && header.kid.length > 0) {
        return this.jwks(header, jwt);
      }
      throw new Error('No trusted verification key');
    }, {
      algorithms: ALGORITHMS,
      issuer: this.issuer,
      audience: 'authenticated',
      requiredClaims: ['sub', 'exp', 'aud', 'iss'],
    });
  }
}
