import { NextResponse } from "next/server";
import { getResumeById } from "@/lib/job-listings/utils/documents";
import { runResumePdf } from "@/lib/job-listings/utils/run-resume-pdf";

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

  const doc = await getResumeById(id);
  if (!doc) {
    return NextResponse.json(
      { error: `Unknown resume id: ${id}` },
      { status: 404 },
    );
  }

  try {
    const result = await runResumePdf(id, {
      baseUrl: requestOrigin(request),
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.output || "PDF generation failed" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, output: result.output });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "PDF generation failed",
      },
      { status: 500 },
    );
  }
}
