import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PROTOCOL = "http";
export const HOST = "127.0.0.1";
export const PORT = 4173;
export const BASE_URL = `${PROTOCOL}://${HOST}:${PORT}`;

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function ensurePortFree() {
  await new Promise((resolveProbe, rejectProbe) => {
    const probe = createServer();
    probe.once("error", (error) => rejectProbe(new Error("预览端口 " + PORT + " 已被占用：" + error.code)));
    probe.once("listening", () => probe.close(() => resolveProbe()));
    probe.listen(PORT, "127.0.0.1");
  });
}

async function waitForServer() {
  for (let index = 0; index < 150; index += 1) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // server not ready yet
    }
    await wait(200);
  }
  throw new Error("预览服务器未在 30 秒内启动：" + BASE_URL);
}

/**
 * 启动 vite preview 静态预览服务，并等到首页可访问。
 * @returns {Promise<{url: string, stop: () => Promise<void>}>}
 */
export async function startPreview() {
  if (!existsSync(resolve(ROOT, "dist", "index.html"))) {
    throw new Error("dist/index.html 不存在，请先运行 pnpm build");
  }
  await ensurePortFree();
  const server = spawn(
    process.execPath,
    [
      resolve(ROOT, "node_modules", "vite", "bin", "vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(PORT),
      "--strictPort",
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } },
  );
  let serverError = "";
  server.stdout.on("data", (chunk) => process.stdout.write(String(chunk)));
  server.stderr.on("data", (chunk) => {
    const text = String(chunk);
    process.stderr.write(text);
    if (/EADDRINUSE|already in use/i.test(text)) serverError = text.trim();
  });
  const stop = async () => {
    if (!server.killed) server.kill();
    await Promise.race([
      new Promise((resolveExit) => server.once("exit", resolveExit)),
      wait(5000),
    ]);
  };
  try {
    await waitForServer();
    if (serverError) throw new Error("预览服务器启动失败：" + serverError);
    if (server.exitCode !== null) throw new Error("预览服务器提前退出，退出码 " + server.exitCode);
    return { url: BASE_URL, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
