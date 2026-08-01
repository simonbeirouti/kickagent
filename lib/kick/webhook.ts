import { verify as verifySignature } from "node:crypto";
import { optionalEnv } from "@/lib/env";

const DEFAULT_KICK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

export interface VerifiedKickWebhook {
  readonly eventMessageId: string;
  readonly eventType: string;
  readonly eventVersion: string;
  readonly timestamp: string;
}

export function verifyKickWebhook(request: Request, rawBody: string): VerifiedKickWebhook {
  const eventMessageId = requiredHeader(request, "Kick-Event-Message-Id");
  const timestamp = requiredHeader(request, "Kick-Event-Message-Timestamp");
  const signature = requiredHeader(request, "Kick-Event-Signature");
  const eventType = requiredHeader(request, "Kick-Event-Type");
  const eventVersion = requiredHeader(request, "Kick-Event-Version");
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) {
    throw new Error("Kick webhook timestamp is invalid.");
  }
  const signedPayload = `${eventMessageId}.${timestamp}.${rawBody}`;
  const publicKey = (optionalEnv("KICK_PUBLIC_KEY") ?? DEFAULT_KICK_PUBLIC_KEY).replaceAll(
    "\\n",
    "\n",
  );
  const valid = verifySignature(
    "RSA-SHA256",
    Buffer.from(signedPayload),
    publicKey,
    Buffer.from(signature, "base64"),
  );
  if (!valid) throw new Error("Kick webhook signature is invalid.");
  return { eventMessageId, eventType, eventVersion, timestamp };
}

export function windowStartFor(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 30_000) * 30_000);
}

export function nextWindow(date: Date): { readonly end: Date; readonly start: Date } {
  const end = new Date(Math.floor(date.getTime() / 30_000) * 30_000 + 30_000);
  return { end, start: new Date(end.getTime() - 30_000) };
}

function requiredHeader(request: Request, name: string): string {
  const value = request.headers.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name} header.`);
  return value;
}
