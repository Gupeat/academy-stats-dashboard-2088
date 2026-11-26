import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Windows 沙箱下 esbuild 无法使用系统临时目录时，固定项目内的临时目录。
const tmpDir = resolve(ROOT, ".esbuild-tmp");
mkdirSync(tmpDir, { recursive: true });
process.env.TEMP = tmpDir;
process.env.TMP = tmpDir;

function runStep(title, args) {
  console.log("[build] " + title);
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, TEMP: tmpDir, TMP: tmpDir },
  });
  if (result.status !== 0) {
    console.error("[build] 失败：" + title);
    process.exit(result.status ?? 1);
  }
}

runStep("typecheck", [resolve(ROOT, "node_modules", "typescript", "bin", "tsc"), "--noEmit"]);

const { build } = await import("vite");
await build({ root: ROOT, configFile: resolve(ROOT, "vite.config.ts"), logLevel: "info" });
console.log("[build] 完成");
// Node 26 + Vite 5 在 Windows 上偶发在事件循环收尾时触发 libuv 断言
// （Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)）；构建产物已落盘，
// 这里显式退出，避免把工具链收尾崩溃误判为构建失败。
process.exit(0);
