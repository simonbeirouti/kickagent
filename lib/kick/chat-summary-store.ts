import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { optionalEnv } from "@/lib/env";
import type { ChatSummary } from "@/lib/kick/types";

// 24h retention at one window per 20s, matching the other tables' cleanup window
// (see lib/cleanup.ts). This is a local JSON file, not Supabase/Postgres: on Vercel
// the filesystem outside /tmp is read-only and not shared across invocations, so
// this store only persists across ticks when the workflow runs against a
// long-lived filesystem (local dev, a self-hosted server, etc).
const RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOWS_PER_CONNECTION = 4_320;

export interface ChatSummaryWindowComplete extends ChatSummary {
  readonly generatedAt: string;
  readonly messageCount: number;
  readonly status: "complete";
  readonly updatedAt: string;
  readonly windowEnd: string;
  readonly windowStart: string;
}

export interface ChatSummaryWindowFailed {
  readonly error: string;
  readonly status: "failed";
  readonly updatedAt: string;
  readonly windowEnd: string;
  readonly windowStart: string;
}

export type ChatSummaryWindowRecord = ChatSummaryWindowComplete | ChatSummaryWindowFailed;

type ChatSummaryStoreFile = Record<string, ChatSummaryWindowRecord[]>;

function storePath(): string {
  return (
    optionalEnv("CHAT_SUMMARY_STORE_PATH") ?? resolve(process.cwd(), ".data", "chat-summaries.json")
  );
}

// Serializes reads/writes so overlapping ticks (e.g. a retry racing the next
// window) can't clobber each other's read-modify-write cycle.
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readStore(): Promise<ChatSummaryStoreFile> {
  try {
    const raw = await readFile(storePath(), "utf8");
    return JSON.parse(raw) as ChatSummaryStoreFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function writeStore(store: ChatSummaryStoreFile): Promise<void> {
  const path = storePath();
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(store, null, 2), "utf8");
  await rename(tempPath, path);
}

export async function listChatSummaryWindows(
  connectionId: string,
): Promise<readonly ChatSummaryWindowRecord[]> {
  const store = await readStore();
  return store[connectionId] ?? [];
}

export async function upsertChatSummaryWindow(
  connectionId: string,
  record: ChatSummaryWindowRecord,
): Promise<void> {
  await serialize(async () => {
    const store = await readStore();
    const windows = store[connectionId] ?? [];
    const index = windows.findIndex((existing) => existing.windowStart === record.windowStart);
    if (index === -1) windows.push(record);
    else windows[index] = record;
    windows.sort((a, b) => a.windowStart.localeCompare(b.windowStart));
    store[connectionId] = windows.slice(-MAX_WINDOWS_PER_CONNECTION);
    await writeStore(store);
  });
}

export async function pruneChatSummaryWindows(connectionId: string): Promise<void> {
  await serialize(async () => {
    const store = await readStore();
    const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
    const windows = (store[connectionId] ?? []).filter((record) => record.windowStart >= cutoff);
    if (windows.length === 0) delete store[connectionId];
    else store[connectionId] = windows;
    await writeStore(store);
  });
}
