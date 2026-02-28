import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";

const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_IV_BYTES = 12;
const BOOKMARKLET_SECRET_BYTES = 24;

const readEncryptionMaterial = (): string => {
  const explicit = process.env.READER_ENCRYPTION_KEY;
  if (explicit && explicit.trim().length > 0) {
    return explicit;
  }

  const fallback = process.env.NEXTAUTH_SECRET;
  if (fallback && fallback.trim().length > 0) {
    return fallback;
  }

  throw new Error(
    "Missing READER_ENCRYPTION_KEY or NEXTAUTH_SECRET for Reader secret encryption.",
  );
};

const encryptionKey = (): Buffer => {
  return createHash("sha256")
    .update(readEncryptionMaterial(), "utf8")
    .digest();
};

const parseEncryptedPayload = (
  payload: string,
): {
  iv: Buffer;
  authTag: Buffer;
  cipherText: Buffer;
} => {
  const parts = payload.split(".");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted payload format.");
  }

  const [version, ivBase64, tagBase64, cipherBase64] = parts;
  if (version !== ENCRYPTION_VERSION) {
    throw new Error("Unsupported encrypted payload version.");
  }

  return {
    iv: Buffer.from(ivBase64, "base64url"),
    authTag: Buffer.from(tagBase64, "base64url"),
    cipherText: Buffer.from(cipherBase64, "base64url"),
  };
};

const serializeEncryptedPayload = (
  iv: Buffer,
  authTag: Buffer,
  cipherText: Buffer,
): string => {
  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    cipherText.toString("base64url"),
  ].join(".");
};

export const encryptReaderSecret = (plainText: string): string => {
  if (!plainText.trim()) {
    throw new Error("Cannot encrypt an empty Reader secret.");
  }

  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey(), iv);
  const cipherText = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  return serializeEncryptedPayload(iv, cipher.getAuthTag(), cipherText);
};

export const decryptReaderSecret = (payload: string): string => {
  const { iv, authTag, cipherText } = parseEncryptedPayload(payload);
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    encryptionKey(),
    iv,
  );
  decipher.setAuthTag(authTag);

  const plainText = Buffer.concat([
    decipher.update(cipherText),
    decipher.final(),
  ]);

  return plainText.toString("utf8");
};

export const generateBookmarkletSecret = (): string => {
  const token = randomBytes(BOOKMARKLET_SECRET_BYTES).toString(
    "base64url",
  );
  return `kcr_${token}`;
};

export const hashBookmarkletSecret = (secret: string): string => {
  return createHash("sha256").update(secret, "utf8").digest("hex");
};

export const safeSecretMatch = (
  providedSecret: string,
  expectedHash: string,
): boolean => {
  const providedHash = hashBookmarkletSecret(providedSecret);
  const left = Buffer.from(providedHash, "hex");
  const right = Buffer.from(expectedHash, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
};
