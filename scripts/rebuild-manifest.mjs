#!/usr/bin/env node
/**
 * 重建 repo/MANIFEST.sha256：按路径排序，排除 MANIFEST 自身、node_modules、dist 等构建目录。
 * 用法：node scripts/rebuild-manifest.mjs
 *
 * 说明：MANIFEST 是交付包完整性清单。`npm run check` 会重写 artifacts/expected-stats.json，
 * 因此重跑校验后需要执行本脚本恢复清单一致；重建 zip 时打包工具也会重新生成同内容清单。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git", "__pycache__"]);
const rows = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const rel = path.relative(ROOT, absolute).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(absolute);
      continue;
    }
    if (!entry.isFile()) continue;
    if (rel === "MANIFEST.sha256") continue;
    if (rel.endsWith(".pyc")) continue;
    const digest = crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
    rows.push([digest, rel]);
  }
}

walk(ROOT);
rows.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
fs.writeFileSync(path.join(ROOT, "MANIFEST.sha256"), rows.map(([d, r]) => `${d}  ${r}`).join("\n") + "\n");
console.log(`MANIFEST rebuilt: ${rows.length} files`);
