const AES_GCM_IV_BYTES = 12;
const AES_GCM_KEY_BYTES = 32;

type EncryptedPayload = {
  iv: string;
  ciphertext: string;
};

const isEncryptedPayload = (value: unknown): value is EncryptedPayload =>
  (() => {
    if (typeof value !== "object" || value === null) return false;

    const payload = value as Record<string, unknown>;
    return (
      typeof payload.iv === "string" &&
      payload.iv.length > 0 &&
      typeof payload.ciphertext === "string" &&
      payload.ciphertext.length > 0
    );
  })();

const decodeBase64 = (value: string) =>
  Uint8Array.from(Buffer.from(value, "base64"));

const encodeBase64 = (value: Uint8Array) =>
  Buffer.from(value).toString("base64");

const parseEncryptionKey = (encodedKey: string) => {
  const bytes = decodeBase64(encodedKey);
  if (bytes.byteLength !== AES_GCM_KEY_BYTES) {
    throw new Error(
      "INTEGRATION_SECRET_ENCRYPTION_KEY must decode to 32 bytes"
    );
  }
  return bytes;
};

const importEncryptionKey = (encodedKey: string) =>
  crypto.subtle.importKey(
    "raw",
    parseEncryptionKey(encodedKey),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );

export const encryptSecret = async ({
  plaintext,
  encodedKey,
}: {
  plaintext: string;
  encodedKey: string;
}) => {
  const key = await importEncryptionKey(encodedKey);
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encoded
  );

  return JSON.stringify({
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  } satisfies EncryptedPayload);
};

export const decryptSecret = async ({
  encrypted,
  encodedKey,
}: {
  encrypted: string;
  encodedKey: string;
}) => {
  let payload: unknown;

  try {
    payload = JSON.parse(encrypted);
  } catch {
    throw new Error("Encrypted payload is invalid");
  }

  if (!isEncryptedPayload(payload)) {
    throw new Error("Encrypted payload is invalid");
  }

  const key = await importEncryptionKey(encodedKey);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64(payload.iv),
      },
      key,
      decodeBase64(payload.ciphertext)
    );
  } catch {
    throw new Error("Decryption failed");
  }

  return new TextDecoder().decode(plaintext);
};
