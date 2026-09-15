import { spawn } from "node:child_process";

export type RunResumePdfOptions = {
  baseUrl?: string;
  /** Survive Next HMR after resume files are rewritten during resync. */
  detach?: boolean;
};

function isSafeResumeId(id: string) {
  return /^[\w.-]+$/.test(id);
}

export function runResumePdf(id: string, options: RunResumePdfOptions = {}) {
  if (!isSafeResumeId(id)) {
    return Promise.reject(new Error(`Invalid resume id: ${id}`));
  }

  const env = { ...process.env };
  if (options.baseUrl) {
    env.RESUME_BASE_URL = options.baseUrl;
  }

  if (options.detach) {
    return new Promise<{ ok: boolean; output: string }>((resolve, reject) => {
      // Brief delay so Turbopack can finish reloading the rewritten resume
      // module before Playwright hits the page.
      const child = spawn(
        `sleep 2 && npm run resume:pdf -- ${id}`,
        {
          cwd: process.cwd(),
          env,
          shell: true,
          detached: true,
          stdio: "ignore",
        },
      );
      child.on("error", reject);
      child.unref();
      resolve({ ok: true, output: "started" });
    });
  }

  return new Promise<{ ok: boolean; output: string }>((resolve, reject) => {
    const child = spawn("npm", ["run", "resume:pdf", "--", id], {
      cwd: process.cwd(),
      env,
      shell: true,
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ ok: code === 0, output: output.trim() });
    });
  });
}
