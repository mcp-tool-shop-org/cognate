/**
 * Cryptographic utilities for prompt/output encryption.
 *
 * Uses Node.js crypto for AES-256-GCM encryption with tenant-specific keys.
 * Plaintext SHA-256 hash is computed for integrity verification.
 *
 * NOTE: These are I/O functions (crypto module access). They are isolated
 * here so the rest of the package can remain pure.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

export interface EncryptedPayload {
  readonly ciphertext: string; // base64
  readonly iv: string; // base64
  readonly authTag: string; // base64
}

/** Hash plaintext with SHA-256. */
export function hashPlaintext(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * @param plaintext The text to encrypt
 * @param keyHex 64-character hex string (32 bytes)
 */
export function encrypt(plaintext: string, keyHex: string): EncryptedPayload {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypt payload with AES-256-GCM.
 * @param payload Encrypted payload
 * @param keyHex 64-character hex string (32 bytes)
 */
export function decrypt(payload: EncryptedPayload, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(payload.ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/** Pack encrypted payload into a single string for storage. */
export function serializePayload(payload: EncryptedPayload): string {
  return JSON.stringify({
    c: payload.ciphertext,
    i: payload.iv,
    a: payload.authTag,
  });
}

/** Unpack encrypted payload from storage string. */
export function deserializePayload(serialized: string): EncryptedPayload {
  const parsed = JSON.parse(serialized);
  return { ciphertext: parsed.c, iv: parsed.i, authTag: parsed.a };
}
