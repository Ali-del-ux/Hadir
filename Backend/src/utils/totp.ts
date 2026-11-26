import crypto from 'crypto';

// Standard RFC 4648 Base32 alphabet for TOTP (Google Authenticator / Authy / RFC 6238)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(base32Str: string): Buffer {
  const cleaned = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTOTP(base32Secret: string, timeOffsetSteps = 0): string {
  const window = 30;
  const now = Math.floor(Date.now() / 1000);
  const timeSlice = Math.floor(now / window) + timeOffsetSteps;
  const secretBuffer = base32Decode(base32Secret);

  const hmac = crypto.createHmac('sha1', secretBuffer);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeSlice));
  hmac.update(timeBuffer);
  const hash = hmac.digest();

  const offsetByte = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offsetByte] & 0x7f) << 24) |
    ((hash[offsetByte + 1] & 0xff) << 16) |
    ((hash[offsetByte + 2] & 0xff) << 8) |
    (hash[offsetByte + 3] & 0xff);

  return (binary % 1000000).toString().padStart(6, '0');
}

// RFC 6238 compliant TOTP verification with +-1 window tolerance (30s steps)
export function verifyTOTP(base32Secret: string, token: string): boolean {
  if (!base32Secret || !token) return false;
  const trimmed = token.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;

  for (let offset = -1; offset <= 1; offset++) {
    const otp = generateTOTP(base32Secret, offset);
    if (otp === trimmed) {
      return true;
    }
  }
  return false;
}
