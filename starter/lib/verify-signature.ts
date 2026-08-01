import { createVerify } from "crypto";

export function verifyKickSignature(
  publicKeyPem: string,
  messageId: string,
  timestamp: string,
  rawBody: string,
  signatureB64: string
): boolean {
  try {
    const verify = createVerify("RSA-SHA256");
    verify.update(`${messageId}.${timestamp}.${rawBody}`);
    return verify.verify(publicKeyPem, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}
