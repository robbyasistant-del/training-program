import crypto from 'crypto';

/**
 * Token encryption service using AES-256-GCM
 * Provides authenticated encryption for sensitive token data
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Validates and returns the encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set');
  }

  const key = Buffer.from(encryptionKey, 'hex');

  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex characters), got ${key.length} bytes`
    );
  }

  return key;
}

/**
 * Generates a cryptographically secure random IV
 */
function generateIV(): Buffer {
  return crypto.randomBytes(IV_LENGTH);
}

/**
 * Encrypts a token string using AES-256-GCM
 * Returns encrypted data as a Buffer (IV + authTag + ciphertext)
 */
export function encryptToken(token: string): Buffer {
  try {
    const key = getEncryptionKey();
    const iv = generateIV();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Format: IV (16 bytes) + authTag (16 bytes) + ciphertext
    const result = Buffer.concat([iv, authTag, encrypted]);

    return result;
  } catch (error) {
    // Log error type without exposing sensitive data
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Token encryption failed: ${errorMessage}`);
  }
}

/**
 * Decrypts an encrypted token Buffer
 * Expects format: IV (16 bytes) + authTag (16 bytes) + ciphertext
 */
export function decryptToken(encryptedData: Buffer): string {
  try {
    const key = getEncryptionKey();

    // Validate minimum length (IV + authTag, ciphertext can be empty)
    if (encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted data format: data too short');
    }

    // Extract components
    const iv = encryptedData.subarray(0, IV_LENGTH);
    const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    // Log error type without exposing sensitive data
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Token decryption failed: ${errorMessage}`);
  }
}

/**
 * Utility to generate a new encryption key
 * Run this once and store the result in TOKEN_ENCRYPTION_KEY env var
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Type guard to check if a value is a Buffer
 */
export function isEncryptedToken(value: unknown): value is Buffer {
  return Buffer.isBuffer(value);
}
