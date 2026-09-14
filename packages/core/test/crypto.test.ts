import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  DecryptionError,
  decryptSecretValue,
  encryptSecretValue,
  loadMasterKeyring,
  type MasterKeyring,
} from "../src/crypto/envelope.js";

function keyringWith(...keys: Buffer[]): MasterKeyring {
  const map = new Map<number, Buffer>();
  keys.forEach((k, i) => map.set(i + 1, k));
  return map;
}

describe("envelope encryption", () => {
  it("roundtrips plaintext through encrypt/decrypt", () => {
    const keyring = keyringWith(randomBytes(32));
    const payload = encryptSecretValue("super-secret-value", keyring);
    expect(decryptSecretValue(payload, keyring)).toBe("super-secret-value");
  });

  it("produces a different IV on every call", () => {
    const keyring = keyringWith(randomBytes(32));
    const a = encryptSecretValue("same-value", keyring);
    const b = encryptSecretValue("same-value", keyring);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("fails to decrypt with the wrong key", () => {
    const keyring = keyringWith(randomBytes(32));
    const payload = encryptSecretValue("secret", keyring);
    const wrongKeyring = keyringWith(randomBytes(32));
    expect(() => decryptSecretValue(payload, wrongKeyring)).toThrow(DecryptionError);
  });

  it("fails to decrypt tampered ciphertext", () => {
    const keyring = keyringWith(randomBytes(32));
    const payload = encryptSecretValue("secret", keyring);
    const tampered = {
      ...payload,
      ciphertext: Buffer.from(
        Buffer.from(payload.ciphertext, "base64").map((b, i) => (i === 0 ? b ^ 0xff : b)),
      ).toString("base64"),
    };
    expect(() => decryptSecretValue(tampered, keyring)).toThrow(DecryptionError);
  });

  it("fails to decrypt a tampered auth tag", () => {
    const keyring = keyringWith(randomBytes(32));
    const payload = encryptSecretValue("secret", keyring);
    const tampered = {
      ...payload,
      authTag: Buffer.from(
        Buffer.from(payload.authTag, "base64").map((b, i) => (i === 0 ? b ^ 0xff : b)),
      ).toString("base64"),
    };
    expect(() => decryptSecretValue(tampered, keyring)).toThrow(DecryptionError);
  });

  it("throws when ENVPULSE_MASTER_KEY is missing", () => {
    expect(() => loadMasterKeyring({})).toThrow(/ENVPULSE_MASTER_KEY/);
  });

  it("throws when ENVPULSE_MASTER_KEY does not decode to 32 bytes", () => {
    expect(() => loadMasterKeyring({ ENVPULSE_MASTER_KEY: "too-short" })).toThrow(
      /32 bytes/,
    );
  });

  it("loads multiple key versions for rotation", () => {
    const k1 = randomBytes(32).toString("base64");
    const k2 = randomBytes(32).toString("base64");
    const keyring = loadMasterKeyring({
      ENVPULSE_MASTER_KEY: k1,
      ENVPULSE_MASTER_KEY_V2: k2,
    });
    expect(keyring.size).toBe(2);
    expect(keyring.get(1)!.toString("base64")).toBe(k1);
    expect(keyring.get(2)!.toString("base64")).toBe(k2);
  });
});
