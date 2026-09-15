import { spawn } from "node:child_process";

export function runResumePdf(id: string) {
  return new Promise<{ ok: boolean; output: string }>((resolve, reject) => {
    const child = spawn("npm", ["run", "resume:pdf", "--", id], {
      cwd: process.cwd(),
      env: process.env,
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
