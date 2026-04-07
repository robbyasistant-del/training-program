/**
 * Tests for tokenCrypto.ts
 * Tests AES-256-GCM encryption/decryption functionality
 */

import {
  encryptToken,
  decryptToken,
  generateEncryptionKey,
  isEncryptedToken,
} from '@/lib/crypto/tokenCrypto';

describe('tokenCrypto', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    // Set a valid 32-byte (64 hex chars) encryption key for tests
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('encryptToken', () => {
    it('should encrypt a token successfully', () => {
      const token = 'test_access_token_12345';
      const encrypted = encryptToken(token);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(32); // IV (16) + authTag (16) + ciphertext
    });

    it('should produce different ciphertext for same token (due to random IV)', () => {
      const token = 'same_token';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should throw error when encryption key is not set', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;

      expect(() => encryptToken('test')).toThrow(
        'TOKEN_ENCRYPTION_KEY environment variable is not set'
      );
    });

    it('should throw error when encryption key is invalid length', () => {
      process.env.TOKEN_ENCRYPTION_KEY = 'too_short';

      expect(() => encryptToken('test')).toThrow('TOKEN_ENCRYPTION_KEY must be 32 bytes');
    });

    it('should handle empty token', () => {
      const encrypted = encryptToken('');
      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBe(32); // IV + authTag only, no ciphertext
    });

    it('should handle long tokens', () => {
      const longToken = 'a'.repeat(10000);
      const encrypted = encryptToken(longToken);
      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(32);
    });
  });

  describe('decryptToken', () => {
    it('should decrypt an encrypted token back to original', () => {
      const originalToken = 'my_secret_token_123';
      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it('should throw error for data that is too short', () => {
      const shortBuffer = Buffer.from('too_short');

      expect(() => decryptToken(shortBuffer)).toThrow(
        'Invalid encrypted data format: data too short'
      );
    });

    it('should throw error for corrupted ciphertext', () => {
      const token = 'test_token';
      const encrypted = encryptToken(token) as Buffer;

      // Corrupt the ciphertext portion (encrypted is always defined here)
      const corrupted = Buffer.from(encrypted);
      corrupted[corrupted.length - 1] = ~corrupted[corrupted.length - 1];

      expect(() => decryptToken(corrupted)).toThrow('Token decryption failed');
    });

    it('should throw error when encryption key is not set', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      const dummyBuffer = Buffer.alloc(32);

      expect(() => decryptToken(dummyBuffer)).toThrow(
        'TOKEN_ENCRYPTION_KEY environment variable is not set'
      );
    });
  });

  describe('roundtrip encryption/decryption', () => {
    it('should handle various token formats', () => {
      const testTokens = [
        'simple_token',
        'token-with-dashes_and_underscores.123',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // JWT-like
        'token with spaces',
        'special!@#$%^&*()chars',
        '',
        'unicode_ñáéíóú_中文',
      ];

      testTokens.forEach((token) => {
        const encrypted = encryptToken(token);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(token);
      });
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a valid 32-byte hex key', () => {
      const key = generateEncryptionKey();

      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(Buffer.from(key, 'hex').length).toBe(32);
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('isEncryptedToken', () => {
    it('should return true for Buffer', () => {
      expect(isEncryptedToken(Buffer.from('test'))).toBe(true);
    });

    it('should return false for non-Buffer values', () => {
      expect(isEncryptedToken('string')).toBe(false);
      expect(isEncryptedToken(123)).toBe(false);
      expect(isEncryptedToken(null)).toBe(false);
      expect(isEncryptedToken(undefined)).toBe(false);
      expect(isEncryptedToken({})).toBe(false);
      expect(isEncryptedToken([])).toBe(false);
    });

    it('should return false for Uint8Array (not Buffer)', () => {
      expect(isEncryptedToken(new Uint8Array([1, 2, 3]))).toBe(false);
    });
  });
});
