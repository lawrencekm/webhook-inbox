import { randomBytes, randomUUID } from 'node:crypto';

/**
 * Unambiguous lowercase alphabet: no 0/o, 1/l/i to avoid transcription errors
 * when someone reads an endpoint URL out loud or copies it from a screenshot.
 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const TOKEN_LENGTH = 14;

/** Creates a new endpoint token. ~31^14 ≈ 8e20 possibilities. */
export function createToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let out = '';
  for (let i = 0; i < TOKEN_LENGTH; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Rejects anything that is not a token we could have minted. */
export function isValidToken(value: string | undefined | null): value is string {
  if (!value) return false;
  if (value.length < 8 || value.length > 40) return false;
  return /^[a-z0-9-]+$/.test(value);
}

let lastMillis = 0;
let sameMillisCounter = 0;

/**
 * Sortable request id — `<millis>-<tiebreak>-<random>`.
 *
 * Lexicographic order matches arrival order within a single process, even for
 * captures landing in the same millisecond. The random tail keeps ids unique
 * across concurrent serverless instances. Ordering *between* instances inside
 * one millisecond is arbitrary, which is why delivery is driven by the capture
 * counter rather than by comparing ids.
 */
export function createRequestId(now = Date.now()): string {
  if (now === lastMillis) sameMillisCounter += 1;
  else {
    lastMillis = now;
    sameMillisCounter = 0;
  }
  const tiebreak = sameMillisCounter.toString(36).padStart(4, '0');
  return `${now.toString().padStart(14, '0')}-${tiebreak}-${randomUUID().slice(0, 8)}`;
}
