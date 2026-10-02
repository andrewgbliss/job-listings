import fs from "node:fs/promises";
import path from "node:path";
import { rateLimitPath } from "./paths";
import { MIN_GLOBAL_GAP_MS, MIN_HOST_GAP_MS } from "./types";

type RateState = {
  global: number;
  hosts: Record<string, number>;
};

const USER_AGENT = "job-listings-local/1.0 (personal job search cache)";

let chain: Promise<unknown> = Promise.resolve();

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readState(): Promise<RateState> {
  try {
    const parsed: unknown = JSON.parse(
      await fs.readFile(rateLimitPath(), "utf8"),
    );
    if (!parsed || typeof parsed !== "object") {
      return { global: 0, hosts: {} };
    }
    const record = parsed as { global?: unknown; hosts?: unknown };
    const hosts: Record<string, number> = {};
    if (record.hosts && typeof record.hosts === "object") {
      for (const [host, value] of Object.entries(record.hosts)) {
        if (typeof value === "number" && Number.isFinite(value)) {
          hosts[host] = value;
        }
      }
    }
    return {
      global: typeof record.global === "number" ? record.global : 0,
      hosts,
    };
  } catch {
    return { global: 0, hosts: {} };
  }
}

async function writeState(state: RateState) {
  const filePath = rateLimitPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`);
}

/** One search at a time so outbound calls keep their spacing. */
export function withSearchLock<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function waitForHost(host: string) {
  const state = await readState();
  const now = Date.now();
  const wait = Math.max(
    0,
    MIN_HOST_GAP_MS - (now - (state.hosts[host] ?? 0)),
    MIN_GLOBAL_GAP_MS - (now - state.global),
  );
  if (wait > 0) {
    await sleep(wait);
  }
  const after = Date.now();
  state.hosts[host] = after;
  state.global = after;
  await writeState(state);
}

export async function fetchJson(url: string): Promise<unknown> {
  const host = new URL(url).host;
  await waitForHost(host);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`${host} returned ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}
