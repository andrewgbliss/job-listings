import { after, NextResponse } from "next/server";
import { runResumePdf } from "@/lib/resume/utils/run-resume-pdf";
import { resyncCapturedListing } from "@/lib/resume/write-scraped";

export const runtime = "nodejs";
export const maxDuration = 120;

function requestOrigin(request: Request) {
  try {
    return new URL(request.url).origin;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  let id = "";
  try {
    const payload: unknown = await request.json();
    if (
      payload &&
      typeof payload === "object" &&
      typeof (payload as { id?: unknown }).id === "string"
    ) {
      id = (payload as { id: string }).id.trim();
    }
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with id" },
      { status: 400 },
    );
  }

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    // Retailor first so the page can refresh. PDF runs detached afterward so
    // Turbopack HMR from the resume rewrite cannot kill Playwright, and so the
    // resync button is not stuck waiting.
    const written = await resyncCapturedListing(id);
    const baseUrl = requestOrigin(request);
    after(() => {
      void runResumePdf(id, { baseUrl, detach: true }).catch((error: unknown) => {
        console.error(
          "Resume PDF failed",
          error instanceof Error ? error.message : error,
        );
      });
    });
    return NextResponse.json({
      ok: true,
      ...written,
      pdf: { ok: true, pending: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resync failed";
    const status = /did not look like|No captured HTML|No listing URL/.test(
      message,
    )
      ? 422
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
