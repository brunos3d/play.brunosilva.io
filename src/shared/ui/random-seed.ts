const TOKEN_LENGTH = 8;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Picks which puzzle to play next. This is the only randomness outside the
 * engine, and it never shapes a puzzle: the token it returns is an ordinary
 * seed, and the same token always gives the same board.
 */
export function randomSeedToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
