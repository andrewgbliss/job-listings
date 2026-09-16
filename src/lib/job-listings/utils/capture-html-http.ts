import http from "node:http";
import { resumeIdFromJob } from "./from-job-listing";
import {
  jobUrlsFromHtml,
  listingFromHtml,
  listingLooksLikeAJob,
} from "./listing-from-html";
import { missingStrategyMessage, strategyForUrl } from "./strategy";
import { runResumePdf } from "./run-resume-pdf";
import { saveCapturedHtml, writeCapturedListing } from "./write-scraped";

const MAX_HTML_CHARS = 8_000_000;
const DEFAULT_PORT = 3001;

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown,
) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    ...corsHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

function readBody(request: http.IncomingMessage, limit: number) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Array<Buffer> = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

type CaptureInput = {
  url: string;
  html: string;
  searchUrl?: string;
};

function validateCapturePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { ok: false as const, status: 400, body: { error: "Expected JSON object" } };
  }

  const record = payload as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url.trim() : "";
  const html = typeof record.html === "string" ? record.html : "";
  const searchUrl =
    typeof record.searchUrl === "string" ? record.searchUrl.trim() : undefined;

  if (!url) {
    return { ok: false as const, status: 400, body: { error: "url is required" } };
  }
  try {
    new URL(url);
  } catch {
    return { ok: false as const, status: 400, body: { error: "url must be a valid URL" } };
  }
  if (!html.trim()) {
    return { ok: false as const, status: 400, body: { error: "html is required" } };
  }
  if (html.length > MAX_HTML_CHARS) {
    return { ok: false as const, status: 413, body: { error: "html is too large" } };
  }

  return { ok: true as const, input: { url, html, searchUrl } };
}

function acceptedCaptureBody(input: CaptureInput) {
  return {
    ok: true,
    loading: true,
    message: "loading",
    url: input.url,
    id: resumeIdFromJob({ url: input.url, skills: [] }),
  };
}

async function runCapture(input: CaptureInput) {
  const { url, html, searchUrl } = input;

  if (!strategyForUrl(url)) {
    await saveCapturedHtml({
      html,
      listing: { url, searchUrl, skills: [] },
      discoveredUrls: [url],
    });
    console.warn(missingStrategyMessage(url));
    return;
  }

  const listing = listingFromHtml(html, url, searchUrl);
  if (!listingLooksLikeAJob(listing)) {
    await saveCapturedHtml({
      html,
      listing,
      discoveredUrls: jobUrlsFromHtml(html, url),
    });
    console.warn("HTML did not look like a job listing", listing.url);
    return;
  }

  const written = await writeCapturedListing({
    html,
    listing,
    discoveredUrls: jobUrlsFromHtml(html, url),
  });
  await runResumePdf(written.id).catch((error: unknown) => {
    console.error(
      "Capture PDF failed",
      error instanceof Error ? error.message : error,
    );
  });
}

export function handleCapturePayload(payload: unknown) {
  const validated = validateCapturePayload(payload);
  if (!validated.ok) {
    return { status: validated.status, body: validated.body };
  }
  return {
    status: 202,
    body: acceptedCaptureBody(validated.input),
    work: () => runCapture(validated.input),
  };
}

async function handleCapture(request: http.IncomingMessage) {
  let payload: unknown;
  try {
    const raw = await readBody(request, MAX_HTML_CHARS + 64_000);
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    if (error instanceof Error && error.message === "payload too large") {
      return { status: 413, body: { error: "html is too large" } };
    }
    return { status: 400, body: { error: "Expected JSON body with url and html" } };
  }

  return handleCapturePayload(payload);
}

let started = false;

export function startCaptureHtmlServer(
  port = Number(process.env.CAPTURE_HTML_PORT) || DEFAULT_PORT,
) {
  if (started) {
    return;
  }
  started = true;

  const server = http.createServer(async (request, response) => {
    const host = request.headers.host ?? "";
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
      sendJson(response, 404, { error: "Not available" });
      return;
    }

    const path = (request.url ?? "/").split("?")[0];
    if (path !== "/api/capture-html") {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders());
      response.end();
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "POST only" });
      return;
    }

    try {
      const result = await handleCapture(request);
      sendJson(response, result.status, result.body);
      if (result.work) {
        void result.work().catch((error: unknown) => {
          console.error(
            "Capture failed",
            error instanceof Error ? error.message : error,
          );
        });
      }
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Capture failed",
      });
    }
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.warn(`Capture API already running on http://127.0.0.1:${port}/api/capture-html`);
      return;
    }
    console.error(error);
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Local capture API: http://127.0.0.1:${port}/api/capture-html`);
  });
}
