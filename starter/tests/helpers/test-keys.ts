import { generateKeyPairSync, createSign } from "crypto";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

export { publicKey, privateKey };

export function signPayload(messageId: string, timestamp: string, rawBody: string): string {
  const sign = createSign("RSA-SHA256");
  sign.update(`${messageId}.${timestamp}.${rawBody}`);
  return sign.sign(privateKey).toString("base64");
}
