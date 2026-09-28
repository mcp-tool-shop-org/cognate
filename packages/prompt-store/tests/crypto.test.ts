import { describe, expect, it } from "vitest";
import {
  hashPlaintext,
  encrypt,
  decrypt,
  serializePayload,
  deserializePayload,
} from "../src/crypto.js";

describe("crypto", () => {
  const key = "a".repeat(64); // 32 bytes in hex

  it("hashes plaintext consistently", () => {
    const h1 = hashPlaintext("hello world");
    const h2 = hashPlaintext("hello world");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different inputs", () => {
    const h1 = hashPlaintext("hello");
    const h2 = hashPlaintext("world");
    expect(h1).not.toBe(h2);
  });

  it("round-trips encrypt and decrypt", () => {
    const payload = encrypt("secret message", key);
    expect(payload.ciphertext).toBeTruthy();
    expect(payload.iv).toBeTruthy();
    expect(payload.authTag).toBeTruthy();

    const decrypted = decrypt(payload, key);
    expect(decrypted).toBe("secret message");
  });

  it("fails decryption with wrong key", () => {
    const payload = encrypt("secret", key);
    const wrongKey = "b".repeat(64);
    expect(() => decrypt(payload, wrongKey)).toThrow();
  });

  it("fails decryption with tampered ciphertext", () => {
    const payload = encrypt("secret", key);
    const tampered = { ...payload, ciphertext: payload.ciphertext.slice(0, -4) + "0000" };
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("serializes and deserializes payload", () => {
    const payload = encrypt("test", key);
    const serialized = serializePayload(payload);
    const parsed = deserializePayload(serialized);
    expect(parsed.ciphertext).toBe(payload.ciphertext);
    expect(parsed.iv).toBe(payload.iv);
    expect(parsed.authTag).toBe(payload.authTag);

    const decrypted = decrypt(parsed, key);
    expect(decrypted).toBe("test");
  });
});
