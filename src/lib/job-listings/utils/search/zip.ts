import fs from "node:fs/promises";
import path from "node:path";
import { zipCachePath } from "./paths";
import { fetchJson } from "./rate-limit";
import type { ZipPlace } from "./types";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function placeFromPayload(zip: string, payload: unknown): ZipPlace | undefined {
  const record = asRecord(payload);
  const places = record?.places;
  const first = Array.isArray(places) ? asRecord(places[0]) : undefined;
  if (!first) {
    return undefined;
  }
  const city = asString(first["place name"]);
  const state = asString(first.state);
  const stateAbbr = asString(first["state abbreviation"]);
  if (!city || !state || !stateAbbr) {
    return undefined;
  }
  return { zip, city, state, stateAbbr };
}

async function readCachedZip(zip: string) {
  try {
    return placeFromPayload(zip, JSON.parse(await fs.readFile(zipCachePath(zip), "utf8")));
  } catch {
    return undefined;
  }
}

export async function lookupZip(zip: string): Promise<ZipPlace | undefined> {
  const cached = await readCachedZip(zip);
  if (cached) {
    return cached;
  }
  try {
    const payload = await fetchJson(`https://api.zippopotam.us/us/${zip}`);
    const place = placeFromPayload(zip, payload);
    if (!place) {
      return undefined;
    }
    const filePath = zipCachePath(zip);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(place, null, 2)}\n`);
    return place;
  } catch {
    return undefined;
  }
}
