import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { app, safeStorage } from "electron";

const ALGORITHM_GCM = "aes-256-gcm";
const ALGORITHM_CBC = "aes-256-cbc";
const IV_LENGTH_GCM = 12;

let DEK: Buffer | null = null;

function getDEK(): Buffer {
  if (DEK) return DEK;

  // Lazily retrieve path after app is ready
  const DEK_PATH = path.join(app.getPath("userData"), "dek.bin");
  const defaultSalt = process.env.SESSION_ENCRYPTION_SALT || "default-salt-value-for-blx-crm";
  const fallbackKey = crypto.scryptSync(defaultSalt, "salt", 32);

  try {
    if (fs.existsSync(DEK_PATH)) {
      const encryptedDEK = fs.readFileSync(DEK_PATH);
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        DEK = safeStorage.decrypt(encryptedDEK);
      } else {
        console.warn("safeStorage is not available. Using fallback key derivation.");
        DEK = fallbackKey;
      }
    } else {
      const newKey = crypto.randomBytes(32);
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encrypt(newKey);
        // Ensure folder exists
        fs.mkdirSync(path.dirname(DEK_PATH), { recursive: true });
        fs.writeFileSync(DEK_PATH, encrypted);
        DEK = newKey;
      } else {
        console.warn("safeStorage is not available to secure DEK. Using fallback key.");
        DEK = fallbackKey;
      }
    }
  } catch (err) {
    console.error("Error initializing DEK via safeStorage:", err);
    DEK = fallbackKey;
  }

  return DEK;
}

export function encryptPayload(text: string): string {
  const key = getDEK();
  const iv = crypto.randomBytes(IV_LENGTH_GCM);
  const cipher = crypto.createCipheriv(ALGORITHM_GCM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  // Format: v2:ivHex:authTagHex:ciphertextHex
  return `v2:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptPayload(text: string): string {
  const key = getDEK();

  if (text.startsWith("v2:")) {
    // AES-256-GCM format
    const parts = text.split(":");
    if (parts.length < 4) {
      throw new Error("Invalid encrypted payload format (GCM)");
    }
    const iv = Buffer.from(parts[1], "hex");
    const authTag = Buffer.from(parts[2], "hex");
    const ciphertext = Buffer.from(parts[3], "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM_GCM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    // Secure memory cleanup
    iv.fill(0);
    authTag.fill(0);
    ciphertext.fill(0);

    return decrypted;
  } else {
    // Legacy AES-256-CBC format (v1)
    const legacySalt = crypto.scryptSync(
      process.env.SESSION_ENCRYPTION_SALT || "default-salt",
      "salt",
      32,
    );
    const textParts = text.split(":");
    if (textParts.length < 2) {
      throw new Error("Invalid encrypted payload format (CBC)");
    }
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM_CBC, legacySalt, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    // Secure memory cleanup
    iv.fill(0);
    encryptedText.fill(0);

    return decrypted;
  }
}
