import { NextResponse } from "next/server";
import { runJobSearch, SearchError } from "@/lib/job-listings/utils/search/run-search";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

async function respond(query: string, zip: string, refresh: boolean) {
  try {
    const result = await runJobSearch(query, { refresh, zip });
    return json(200, result);
  } catch (error) {
    if (error instanceof SearchError) {
      return json(error.status, { error: error.message });
    }
    console.error(
      "Job search failed",
      error instanceof Error ? error.message : error,
    );
    return json(500, { error: "Job search failed" });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return respond(
    url.searchParams.get("q") ?? "",
    url.searchParams.get("zip") ?? "",
    url.searchParams.get("refresh") === "1",
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Expected a JSON body with query" });
  }
  const record =
    payload && typeof payload === "object"
      ? (payload as { query?: unknown; zip?: unknown; refresh?: unknown })
      : {};
  const query = typeof record.query === "string" ? record.query : "";
  const zip = typeof record.zip === "string" ? record.zip : "";
  return respond(query, zip, record.refresh === true);
}
