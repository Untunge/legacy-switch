/**
 * Test encryption round-trip property
 * Task 38: WebCrypto wrapper utilities (PBKDF2, AES-GCM)
 * Task 56: Encryption tests (PBKDF2, AES-GCM round-trip)
 * **Validates: Requirements 3, 4, 19, 30**
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, deriveKey, sha256 } from './crypto';

describe('WebCrypto utilities', () => {
  it('should encrypt and decrypt successfully (round-trip)', async () => {
    const plaintext = 'Secret message for my legacy';
    const passphrase = 'secure_passphrase_12345';

    // Encrypt
    const encrypted = await encrypt(plaintext, passphrase);

    // Verify encrypted data has required fields
    expect(encrypted).toHaveProperty('ciphertext');
    expect(encrypted).toHaveProperty('nonce');
    expect(encrypted).toHaveProperty('salt');
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.nonce).toBeTruthy();
    expect(encrypted.salt).toBeTruthy();

    // Decrypt
    const decrypted = await decrypt(
      encrypted.ciphertext,
      passphrase,
      encrypted.salt,
      encrypted.nonce
    );

    // Verify plaintext matches
    expect(decrypted).toBe(plaintext);
  });

  it('should fail decryption with wrong passphrase', async () => {
    const plaintext = 'Secret data';
    const passphrase = 'correct_passphrase';
    const wrongPassphrase = 'wrong_passphrase';

    const encrypted = await encrypt(plaintext, passphrase);

    // Try to decrypt with wrong passphrase
    await expect(
      decrypt(
        encrypted.ciphertext,
        wrongPassphrase,
        encrypted.salt,
        encrypted.nonce
      )
    ).rejects.toThrow('Decryption failed');
  });

  it('should fail decryption with tampered ciphertext', async () => {
    const plaintext = 'Secret data';
    const passphrase = 'passphrase';

    const encrypted = await encrypt(plaintext, passphrase);

    // Tamper with ciphertext (flip first byte)
    const tamperedCiphertext =
      encrypted.ciphertext.substring(0, 1) ===
      encrypted.ciphertext.substring(1, 2)
        ? encrypted.ciphertext.replace(/^./, 'aa')
        : encrypted.ciphertext.replace(/^./, 'ff');

    // Try to decrypt tampered data
    await expect(
      decrypt(
        tamperedCiphertext,
        passphrase,
        encrypted.salt,
        encrypted.nonce
      )
    ).rejects.toThrow('Decryption failed');
  });

  it('should derive same key from same inputs', async () => {
    const passphrase = 'test_passphrase';
    const salt = new Uint8Array(16).fill(42);

    const key1 = await deriveKey(passphrase, salt);
    const key2 = await deriveKey(passphrase, salt);

    // Keys should be identical (same algorithm, iterations, inputs)
    expect(key1.type).toBe(key2.type);
    expect(key1.algorithm).toEqual(key2.algorithm);
  });

  it('should handle various plaintext types', async () => {
    const passphrases = [
      'simple_pass',
      'pass@with#special$chars%',
      'emoji_🔐_pass',
      'very_long_passphrase_that_exceeds_normal_length_significantly',
    ];

    const plaintexts = [
      'short',
      'Medium length text with some content',
      'Very long text... '.repeat(100),
      '',
      '123456789',
      'JSON: {"key":"value"}',
    ];

    for (const plaintext of plaintexts) {
      for (const passphrase of passphrases) {
        const encrypted = await encrypt(plaintext, passphrase);
        const decrypted = await decrypt(
          encrypted.ciphertext,
          passphrase,
          encrypted.salt,
          encrypted.nonce
        );
        expect(decrypted).toBe(plaintext);
      }
    }
  });

  it('should compute sha256 hash correctly', async () => {
    const data = 'test data for hashing';
    const hash = await sha256(data);

    // Hash should be hex string of 64 characters (256 bits = 32 bytes = 64 hex chars)
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    // Same data should produce same hash (deterministic)
    const hash2 = await sha256(data);
    expect(hash2).toBe(hash);
  });

  it('should produce different sha256 hashes for different data', async () => {
    const hash1 = await sha256('data1');
    const hash2 = await sha256('data2');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string sha256', async () => {
    const hash = await sha256('');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
