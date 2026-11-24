/**
 * WebCrypto wrapper utilities for PBKDF2+AES-GCM encryption
 * Task 38: Implements Req 3, Req 4, Req 30
 */

const ITERATIONS = 100000;
const HASH_ALGO = 'SHA-256';
const CIPHER_ALGO = 'AES-GCM';
const KEY_LENGTH = 256; // bits

export interface EncryptedData {
  ciphertext: string; // hex-encoded
  nonce: string; // hex-encoded
  salt: string; // hex-encoded
}

/**
 * Derive a CryptoKey from a passphrase using PBKDF2
 * @param passphrase User's passphrase
 * @param salt Random salt (16 bytes typical)
 * @returns CryptoKey for use with AES-GCM
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: ITERATIONS,
      hash: HASH_ALGO,
    },
    passphraseKey,
    {
      name: CIPHER_ALGO,
      length: KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext with a passphrase
 * @param plaintext Text to encrypt
 * @param passphrase User's passphrase
 * @param salt Optional salt (generated if not provided)
 * @returns Encrypted data with ciphertext, nonce, salt
 */
export async function encrypt(
  plaintext: string,
  passphrase: string,
  salt?: Uint8Array
): Promise<EncryptedData> {
  // Generate salt if not provided (16 bytes = 128 bits)
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }

  // Generate random nonce (12 bytes = 96 bits for AES-GCM)
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from passphrase
  const key = await deriveKey(passphrase, salt);

  // Encrypt
  const enc = new TextEncoder();
  const plainBytes = enc.encode(plaintext);

  const cipherBytes = await crypto.subtle.encrypt(
    {
      name: CIPHER_ALGO,
      iv: nonce as any,
    },
    key,
    plainBytes as any
  );

  // Return hex-encoded values
  return {
    ciphertext: bytesToHex(new Uint8Array(cipherBytes)),
    nonce: bytesToHex(nonce),
    salt: bytesToHex(salt),
  };
}

/**
 * Decrypt ciphertext with a passphrase
 * @param ciphertext Hex-encoded ciphertext
 * @param passphrase User's passphrase
 * @param salt Hex-encoded salt
 * @param nonce Hex-encoded nonce
 * @returns Decrypted plaintext
 * @throws If decryption fails (wrong passphrase or tampered ciphertext)
 */
export async function decrypt(
  ciphertext: string,
  passphrase: string,
  salt: string,
  nonce: string
): Promise<string> {
  try {
    // Convert hex to bytes
    const saltBytes = hexToBytes(salt);
    const nonceBytes = hexToBytes(nonce);
    const cipherBytes = hexToBytes(ciphertext);

    // Derive key from passphrase
    const key = await deriveKey(passphrase, saltBytes);

    // Decrypt
    const plainBytes = await crypto.subtle.decrypt(
      {
        name: CIPHER_ALGO,
        iv: nonceBytes as any,
      },
      key,
      cipherBytes as any
    );

    // Decode to string
    const dec = new TextDecoder();
    return dec.decode(plainBytes);
  } catch (error) {
    throw new Error('Decryption failed. Wrong passphrase or corrupted data.');
  }
}

/**
 * Compute SHA-256 hash of data
 * @param data Data to hash
 * @returns Hex-encoded hash
 */
export async function sha256(data: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    enc.encode(data) as any
  );
  return bytesToHex(new Uint8Array(hashBuffer));
}

// Helper: Convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bufferLength = hex.length / 2;
  const uint8Array = new Uint8Array(bufferLength);
  for (let i = 0; i < bufferLength; i++) {
    uint8Array[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return uint8Array as unknown as Uint8Array;
}
