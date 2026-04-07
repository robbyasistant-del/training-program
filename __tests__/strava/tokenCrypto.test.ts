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
    // Set a test encryption key (32 bytes = 64 hex chars)
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('encryptToken', () => {
    it('should encrypt a token and return a Buffer', () => {
      const token = 'test-access-token-12345';
      const encrypted = encryptToken(token);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertexts for the same token (due to random IV)', () => {
      const token = 'same-token-12345';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      // IVs are different, so ciphertexts should be different
      expect(encrypted1.toString('hex')).not.toBe(encrypted2.toString('hex'));
    });

    it('should throw error when encryption key is not set', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;

      expect(() => encryptToken('test-token')).toThrow(
        'TOKEN_ENCRYPTION_KEY environment variable is not set'
      );
    });

    it('should throw error when encryption key is invalid length', () => {
      process.env.TOKEN_ENCRYPTION_KEY = 'too-short';

      expect(() => encryptToken('test-token')).toThrow('TOKEN_ENCRYPTION_KEY must be 32 bytes');
    });

    it('should handle empty string tokens', () => {
      const token = '';
      const encrypted = encryptToken(token);

      expect(encrypted).toBeInstanceOf(Buffer);

      // Should be able to decrypt back to empty string
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle long tokens', () => {
      const token = 'a'.repeat(1000);
      const encrypted = encryptToken(token);

      expect(encrypted).toBeInstanceOf(Buffer);

      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(token);
    });

    it('should handle tokens with special characters', () => {
      const token = '!@#$%^&*()_+-=[]{}|;\':",./<>?\\n\\t';
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });
  });

  describe('decryptToken', () => {
    it('should decrypt a token back to its original value', () => {
      const originalToken = 'my-secret-access-token';
      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it('should throw error for invalid encrypted data (too short)', () => {
      const invalidData = Buffer.from('short');

      expect(() => decryptToken(invalidData)).toThrow('Invalid encrypted data format');
    });

    it('should throw error for corrupted encrypted data', () => {
      const token = 'test-token';
      const encrypted = encryptToken(token);

      // Corrupt the data by modifying a byte
      if (encrypted.length > 20) {
        encrypted[20] = encrypted[20]! ^ 0xff;
      }

      expect(() => decryptToken(encrypted)).toThrow();
    });

    it('should throw error when decryption key is not set', () => {
      const token = 'test-token';
      const encrypted = encryptToken(token);

      delete process.env.TOKEN_ENCRYPTION_KEY;

      expect(() => decryptToken(encrypted)).toThrow(
        'TOKEN_ENCRYPTION_KEY environment variable is not set'
      );
    });

    it('should throw error when decryption key is wrong', () => {
      const token = 'test-token';
      const encrypted = encryptToken(token);

      // Change the key
      process.env.TOKEN_ENCRYPTION_KEY = 'b'.repeat(64);

      expect(() => decryptToken(encrypted)).toThrow('Token decryption failed');
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a valid 64-character hex string', () => {
      const key = generateEncryptionKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate a key that can be used for encryption', () => {
      const key = generateEncryptionKey();
      process.env.TOKEN_ENCRYPTION_KEY = key;

      const token = 'test-token';
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });
  });

  describe('isEncryptedToken', () => {
    it('should return true for Buffer instances', () => {
      const buffer = Buffer.from('test');
      expect(isEncryptedToken(buffer)).toBe(true);
    });

    it('should return false for string', () => {
      expect(isEncryptedToken('test')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isEncryptedToken(123)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isEncryptedToken(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isEncryptedToken(undefined)).toBe(false);
    });

    it('should return false for object', () => {
      expect(isEncryptedToken({})).toBe(false);
    });
  });

  describe('integration', () => {
    it('should handle realistic Strava token format', () => {
      // Simulating a real Strava access token format
      const accessToken = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';

      const encrypted = encryptToken(accessToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(accessToken);
    });

    it('should handle realistic Strava refresh token format', () => {
      // Simulating a real Strava refresh token format
      const refreshToken = 'refresh_token_abc123def456ghi789';

      const encrypted = encryptToken(refreshToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(refreshToken);
    });
  });
});
