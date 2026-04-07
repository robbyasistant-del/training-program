/**
 * Tests de integración para el flujo OAuth
 * Verifica el comportamiento de los servicios de autenticación
 */

import { encryptToken, decryptToken, generateEncryptionKey } from '@/lib/crypto/tokenCrypto';
import { storeTokens, hasValidConnection, exchangeCodeForTokens } from '@/lib/strava/tokenManager';

// Mock the database
jest.mock('@/lib/db', () => ({
  prisma: {
    stravaConnection: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('OAuth Flow Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: 'test_client_id',
      STRAVA_CLIENT_SECRET: 'test_client_secret',
      TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Step 1: Environment Setup', () => {
    it('should have all required environment variables', () => {
      expect(process.env.STRAVA_CLIENT_ID).toBeDefined();
      expect(process.env.STRAVA_CLIENT_SECRET).toBeDefined();
      expect(process.env.TOKEN_ENCRYPTION_KEY).toBeDefined();
    });

    it('should generate valid encryption key', () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Step 2: Token Encryption Security', () => {
    it('should encrypt tokens so they are not readable', () => {
      const originalToken = 'sensitive_access_token_12345';
      const encrypted = encryptToken(originalToken);

      // Encrypted should be binary data (Buffer/Uint8Array)
      expect(Buffer.isBuffer(encrypted) || (encrypted as Uint8Array) instanceof Uint8Array).toBe(
        true
      );

      // The encrypted data should not contain the original token
      const encryptedString = Buffer.from(encrypted).toString('base64');
      expect(encryptedString).not.toContain(originalToken);
      expect(encryptedString).not.toContain('sensitive');
    });

    it('should decrypt tokens back to original value', () => {
      const originalToken = 'test_token_for_encryption';
      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(Buffer.from(encrypted));

      expect(decrypted).toBe(originalToken);
    });

    it('should produce different ciphertexts for same token (random IV)', () => {
      const token = 'same_token';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      expect(Buffer.from(encrypted1).toString('hex')).not.toBe(
        Buffer.from(encrypted2).toString('hex')
      );
    });
  });

  describe('Step 3: OAuth Token Exchange', () => {
    it('should exchange authorization code for tokens', async () => {
      const mockTokens = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        athlete: { id: 12345 },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokens),
      });

      const result = await exchangeCodeForTokens('auth_code_123');

      expect(result.access_token).toBe('new_access_token');
      expect(result.refresh_token).toBe('new_refresh_token');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.strava.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle OAuth errors from Strava', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ message: 'Invalid code' }),
      });

      await expect(exchangeCodeForTokens('invalid_code')).rejects.toThrow('Token exchange failed');
    });

    it('should handle network failures gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(exchangeCodeForTokens('code')).rejects.toThrow();
    });
  });

  describe('Step 4: Token Storage', () => {
    it('should store tokens encrypted in database', async () => {
      const { prisma } = await import('@/lib/db');

      const tokens = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_456',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
      };

      await storeTokens('athlete-123', tokens);

      expect(prisma.stravaConnection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { athleteId: 'athlete-123' },
          create: expect.objectContaining({
            encryptedAccessToken: expect.any(Uint8Array),
            encryptedRefreshToken: expect.any(Uint8Array),
            expiresAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('Step 5: Connection Validation', () => {
    it('should report valid connection for non-expired token', async () => {
      const { prisma } = await import('@/lib/db');

      (prisma.stravaConnection.findUnique as jest.Mock).mockResolvedValue({
        athleteId: 'athlete-123',
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
      });

      const isValid = await hasValidConnection('athlete-123');
      expect(isValid).toBe(true);
    });

    it('should report invalid connection for expired token', async () => {
      const { prisma } = await import('@/lib/db');

      (prisma.stravaConnection.findUnique as jest.Mock).mockResolvedValue({
        athleteId: 'athlete-123',
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      const isValid = await hasValidConnection('athlete-123');
      expect(isValid).toBe(false);
    });

    it('should report no connection when not found', async () => {
      const { prisma } = await import('@/lib/db');

      (prisma.stravaConnection.findUnique as jest.Mock).mockResolvedValue(null);

      const isValid = await hasValidConnection('unknown-athlete');
      expect(isValid).toBe(false);
    });
  });

  describe('Complete OAuth Flow', () => {
    it('should handle complete flow: connect → store → validate', async () => {
      const { prisma } = await import('@/lib/db');

      // 1. Exchange code for tokens
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'complete_flow_access',
          refresh_token: 'complete_flow_refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
        }),
      });

      const tokens = await exchangeCodeForTokens('auth_code');
      expect(tokens.access_token).toBe('complete_flow_access');

      // 2. Store tokens
      (prisma.stravaConnection.upsert as jest.Mock).mockResolvedValueOnce({});
      await storeTokens('athlete-complete', tokens);
      expect(prisma.stravaConnection.upsert).toHaveBeenCalled();

      // 3. Verify valid connection
      (prisma.stravaConnection.findUnique as jest.Mock).mockResolvedValueOnce({
        athleteId: 'athlete-complete',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      });

      const isValid = await hasValidConnection('athlete-complete');
      expect(isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid encryption key', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;

      expect(() => encryptToken('test')).toThrow(
        'TOKEN_ENCRYPTION_KEY environment variable is not set'
      );
    });

    it('should throw error for invalid encrypted data', () => {
      const invalidData = Buffer.from('too-short');

      expect(() => decryptToken(invalidData)).toThrow('Invalid encrypted data format');
    });

    it('should handle database errors gracefully', async () => {
      const { prisma } = await import('@/lib/db');

      (prisma.stravaConnection.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      // hasValidConnection should return false on error, not throw
      const isValid = await hasValidConnection('athlete-123');
      expect(isValid).toBe(false);
    });
  });

  describe('Security Requirements', () => {
    it('should never expose tokens in error messages', async () => {
      const sensitiveToken = 'secret_token_12345';

      try {
        delete process.env.TOKEN_ENCRYPTION_KEY;
        encryptToken(sensitiveToken);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '';
        expect(errorMessage).not.toContain(sensitiveToken);
      }
    });

    it('should use unique IV for each encryption', () => {
      const token = 'test_token';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      // First 16 bytes should be different (IV)
      const iv1 = encrypted1.slice(0, 16);
      const iv2 = encrypted2.slice(0, 16);

      expect(Buffer.from(iv1).toString('hex')).not.toBe(Buffer.from(iv2).toString('hex'));
    });
  });
});
