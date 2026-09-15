import { NextResponse } from "next/server";
import { runResumePdf } from "@/lib/resume/run-resume-pdf";
import { resyncCapturedListing } from "@/lib/resume/write-scraped";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    const written = await resyncCapturedListing(id);
    const pdf = await runResumePdf(id);
    return NextResponse.json({
      ok: true,
      ...written,
      pdf,
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
