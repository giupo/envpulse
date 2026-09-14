import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export class DecryptionError extends Error {}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
  keyVersion: number;
}

export type MasterKeyring = ReadonlyMap<number, Buffer>;

/**
 * Reads ENVPULSE_MASTER_KEY (key version 1) and optional ENVPULSE_MASTER_KEY_V2,
 * _V3, ... for future key rotation. Fails fast if the primary key is missing
 * or does not decode to exactly 32 bytes.
 */
export function loadMasterKeyring(
  env: NodeJS.ProcessEnv = process.env,
): MasterKeyring {
  const keyring = new Map<number, Buffer>();

  const primary = env.ENVPULSE_MASTER_KEY;
  if (!primary) {
    throw new Error("ENVPULSE_MASTER_KEY environment variable is required");
  }
  keyring.set(1, decodeKey(primary, "ENVPULSE_MASTER_KEY"));

  for (let version = 2; env[`ENVPULSE_MASTER_KEY_V${version}`]; version++) {
    const varName = `ENVPULSE_MASTER_KEY_V${version}`;
    keyring.set(version, decodeKey(env[varName]!, varName));
  }

  return keyring;
}

function decodeKey(value: string, varName: string): Buffer {
  let buf = Buffer.from(value, "base64");
  if (buf.length !== KEY_LENGTH) {
    buf = Buffer.from(value, "hex");
  }
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `${varName} must decode to exactly ${KEY_LENGTH} bytes (base64 or hex encoded)`,
    );
  }
  return buf;
}

function latestKeyVersion(keyring: MasterKeyring): number {
  return Math.max(...keyring.keys());
}

export function encryptSecretValue(
  plaintext: string,
  keyring: MasterKeyring,
  keyVersion: number = latestKeyVersion(keyring),
): EncryptedPayload {
  const key = keyring.get(keyVersion);
  if (!key) {
    throw new Error(`No master key found for key version ${keyVersion}`);
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion,
  };
}

export function decryptSecretValue(
  payload: EncryptedPayload,
  keyring: MasterKeyring,
): string {
  const key = keyring.get(payload.keyVersion);
  if (!key) {
    throw new DecryptionError(
      `No master key found for key version ${payload.keyVersion}`,
    );
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new DecryptionError(
      "Failed to decrypt secret value: authentication failed or data corrupted",
    );
  }
}
