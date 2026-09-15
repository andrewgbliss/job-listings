export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  const { startCaptureHtmlServer } = await import("./lib/resume/capture-html-http");
  startCaptureHtmlServer();
}
