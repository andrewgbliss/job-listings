import { after, NextResponse } from "next/server";
import { handleCapturePayload } from "@/lib/job-listings/utils/capture-html-http";

export const runtime = "nodejs";
export const maxDuration = 120;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Expected JSON body with url and html" });
  }

  const result = handleCapturePayload(payload);
  if (result.work) {
    const work = result.work;
    after(async () => {
      try {
        await work();
      } catch (error: unknown) {
        console.error(
          "Capture failed",
          error instanceof Error ? error.message : error,
        );
      }
    });
  }
  return json(result.status, result.body);
}
