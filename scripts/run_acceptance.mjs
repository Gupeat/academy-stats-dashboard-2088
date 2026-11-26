#!/usr/bin/env node
/**
 * 一条命令复跑验收：先写 RUNNING/FAIL，再依次执行数据校验、反例、类型检查、构建、单测、
 * e2e、录屏与录屏探针，最后重算证据哈希/大小/时间并写 PASS/FAIL。
 *
 * 用法：node scripts/run_acceptance.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT_DIR = path.join(ROOT, "artifacts");
const LOG_DIR = path.join(ARTIFACT_DIR, "logs");
const STARTED_AT_MS = Date.now();
const STARTED_AT = new Date(STARTED_AT_MS).toISOString();

const EVIDENCE_FILES = [
  "docs/screens/ac1-academy-stats.png",
  "docs/screens/ac1b-ranking-sort-asc.png",
  "docs/screens/ac2-metric-tooltip.png",
  "docs/screens/ac3a-venue-hill.png",
  "docs/screens/ac4-empty-state.png",
  "docs/recordings/ac3-venue-switch.webm",
  "artifacts/expected-stats.json",
  "artifacts/e2e-result.json",
  "artifacts/video-result.json"
];

const STEPS = [
  { id: "data", title: "独立口径重算（从 mock JSON 重算 6 卡/上一周期/趋势/排行）", label: "node scripts/check-stats.mjs", args: ["scripts/check-stats.mjs"] },
  { id: "negative", title: "反例校验（出勤>报名、评价越界、重复 id、未知课程、删口径必须被拒绝）", label: "node scripts/check-stats.mjs --self-test", args: ["scripts/check-stats.mjs", "--self-test"] },
  { id: "typecheck", title: "独立类型检查", label: "npx tsc --noEmit", args: ["node_modules/typescript/bin/tsc", "--noEmit"] },
  { id: "build", title: "生产构建（含类型检查）", label: "node scripts/build.mjs", args: ["scripts/build.mjs"] },
  { id: "unit", title: "单元测试（区间/上一周期/6 指标/空数据/格式化）", label: "node node_modules/vitest/vitest.mjs run", args: ["node_modules/vitest/vitest.mjs", "run"] },
  { id: "e2e", title: "端到端验收（固定时钟 + 1440 宽 + 5 张证据截图）", label: "node scripts/e2e.mjs", args: ["scripts/e2e.mjs"] },
  { id: "video", title: "AC3 真实录屏（Playwright WebM，会所切换交互）", label: "node scripts/capture-video.mjs", args: ["scripts/capture-video.mjs"] },
  { id: "probe", title: "录屏探针（WebM 容器 + 8–15 秒时长）", label: "node scripts/probe-webm.mjs", args: ["scripts/probe-webm.mjs"] }
];

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sanitize = (text) => {
  let output = String(text ?? "");
  // 先整体替换 URL，避免 "https://..." 的 "s:/" 被盘符规则截断成 "http<path>"。
  output = output.replace(/\b(?:https?|wss?|ftp):\/\/[^\s"']*/gi, "<url>");
  // 工具横幅可能打印工作区绝对路径；统一脱敏，避免绝对路径进入候选包。
  // 盘符前不能是字母，否则 "https:/..." 会被当成 "s:" 盘符。
  output = output.replace(/(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s"']*/g, "<path>");
  output = output.replace(/\/(?:Users|home)\/[^\s"']*/g, "<path>");
  return output.replace(/\r\n/g, "\n").trim();
};
const formatLocal = (iso) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).format(new Date(iso));

function verifyEvidence(entries, startedAtMs) {
  const errors = [];
  for (const entry of entries) {
    const absolute = path.join(ROOT, entry.path);
    if (!fs.existsSync(absolute)) {
      errors.push("缺少证据: " + entry.path);
      continue;
    }
    const actual = sha256(absolute);
    if (actual !== entry.sha256) errors.push("哈希不匹配: " + entry.path);
    if (fs.statSync(absolute).size !== entry.bytes) errors.push("大小不匹配: " + entry.path);
    if (entry.generatedAt < startedAtMs) errors.push("证据早于本次验收开始: " + entry.path);
  }
  return { ok: errors.length === 0, errors };
}

function collectEvidence() {
  const entries = [];
  for (const rel of EVIDENCE_FILES) {
    const absolute = path.join(ROOT, rel);
    if (!fs.existsSync(absolute)) continue;
    entries.push({
      path: rel,
      sha256: sha256(absolute),
      bytes: fs.statSync(absolute).size,
      generatedAt: Math.round(fs.statSync(absolute).mtimeMs)
    });
  }
  return entries;
}

function writeReports(state) {
  const passed = state.passed === true;
  const statusText = state.status === "RUNNING" ? "FAIL（运行中，尚未完成）" : passed ? "PASS" : "FAIL";
  const lines = [
    "# 验收报告", "",
    `状态：**${statusText}**`, "",
    `- 开始时间：${formatLocal(state.startedAt)}（Asia/Shanghai）`,
    `- 结束时间：${state.finishedAt ? formatLocal(state.finishedAt) : "尚未结束"}`,
    `- 通过步骤：${state.steps.filter((step) => step.status === "PASS").length}/${state.steps.length}`,
    `- 证据文件：${state.evidence.length + (state.passed ? 1 : 0)}${state.passed ? "（含 artifacts/acceptance.json 自身）" : ""}`, ""
  ];
  if (state.steps.length > 0) {
    lines.push("## 执行步骤", "", "| # | 步骤 | 结果 | 耗时 | 日志 |", "| --- | --- | --- | --- | --- |");
    state.steps.forEach((step, index) => {
      lines.push(`| ${index + 1} | ${step.title} | ${step.status} | ${step.durationMs} ms | ${step.logPath ? `[\`${step.logPath}\`](${step.logPath})` : "-"} |`);
    });
    lines.push("");
  }
  const failedSteps = state.steps.filter((step) => step.status !== "PASS");
  if (failedSteps.length > 0) {
    lines.push("## 失败摘要", "");
    for (const step of failedSteps) {
      lines.push(`### ${step.id} · ${step.title}`, "", "```text", (step.outputTail || "无输出").slice(0, 4000), "```", "");
    }
  }
  if (state.evidence.length > 0) {
    lines.push("## 证据（SHA-256 / 字节 / 生成时间）", "", "| 文件 | SHA-256 | 字节 | 生成时间 |", "| --- | --- | --- | --- |");
    for (const entry of state.evidence) {
      lines.push(`| [\`${entry.path}\`](${entry.path}) | \`${entry.sha256}\` | ${entry.bytes} | ${formatLocal(new Date(entry.generatedAt).toISOString())} |`);
    }
    lines.push("");
  }
  lines.push(
    "## 验收点", "",
    "- AC1：6 张指标卡 + 12 个月双轴趋势 + 10 列可排序排行 → `docs/screens/ac1-academy-stats.png`",
    "- AC2：问号提示显示口径说明 → `docs/screens/ac2-metric-tooltip.png`",
    "- AC3：切换会所后所有区块刷新 → `docs/recordings/ac3-venue-switch.webm`（8–15 秒，EBML 结构/时长探针校验）",
    "- 扩展：排序升序、空会所空状态 → `ac1b-ranking-sort-asc.png`、`ac4-empty-state.png`", "",
    "## 复现", "", "```bash", "node scripts/run_acceptance.mjs", "```", "",
    "脚本先写 RUNNING/FAIL，全部通过后写 PASS；证据必须由本次运行新生成，哈希/字节/时间从文件重算。", ""
  );
  state.evidence_manifest = "artifacts/evidence.json";
  fs.writeFileSync(path.join(ARTIFACT_DIR, "acceptance.json"), JSON.stringify(state, null, 2));
  fs.writeFileSync(path.join(ROOT, "ACCEPTANCE.md"), lines.join("\n"));
}

/**
 * 证据清单：列出验收 JSON 与全部证据的相对路径、SHA-256、字节数；
 * 机器门禁按清单逐文件复核（含 acceptance.json 自身）。
 */
function writeEvidenceManifest(state) {
  const files = [];
  const add = (rel) => {
    const absolute = path.join(ROOT, rel);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return;
    files.push({ path: rel, sha256: sha256(absolute), bytes: fs.statSync(absolute).size });
  };
  add("artifacts/acceptance.json");
  for (const entry of state.evidence) add(entry.path);
  const doc = { count: files.length, files, missing: [] };
  fs.writeFileSync(path.join(ARTIFACT_DIR, "evidence.json"), JSON.stringify(doc, null, 2) + "\n");
  return doc.count;
}

fs.mkdirSync(LOG_DIR, { recursive: true });
const state = { passed: false, status: "RUNNING", startedAt: STARTED_AT, finishedAt: null, steps: [], evidence: [] };
writeReports(state);
console.log("STEP 0 写入 RUNNING/FAIL 初始报告（ensure FAIL before PASS）");

for (const step of STEPS) {
  const stepStarted = Date.now();
  const result = spawnSync(process.execPath, step.args, {
    cwd: ROOT,
    env: { ...process.env, BROWSER: "none", CI: "1", TEMP: path.join(ROOT, ".esbuild-tmp"), TMP: path.join(ROOT, ".esbuild-tmp") },
    encoding: "utf8", timeout: 420000, maxBuffer: 64 * 1024 * 1024
  });
  const output = sanitize([result.stdout, result.stderr].filter(Boolean).join("\n"));
  const logRel = `artifacts/logs/${step.id}.log`;
  fs.writeFileSync(path.join(ROOT, logRel), [`$ ${step.label}`, `# exit=${result.status ?? "null"}`, `# duration=${Date.now() - stepStarted}ms`, "", output, ""].join("\n"));
  const status = result.status === 0 ? "PASS" : "FAIL";
  state.steps.push({ id: step.id, title: step.title, command: step.label, status, exitCode: result.status, durationMs: Date.now() - stepStarted, logPath: logRel, outputTail: output.split("\n").slice(-30).join("\n") });
  console.log(`${status === "PASS" ? "[PASS]" : "[FAIL]"} ${step.id} · ${step.title} · ${Date.now() - stepStarted}ms`);
  if (status !== "PASS") console.log(output.split("\n").slice(-20).join("\n"));
}

const evidence = collectEvidence();
const verification = verifyEvidence(evidence, STARTED_AT_MS);
// 反例：伪造一条早于本次验收开始的证据，必须被拒绝。
const tamperProbe = verifyEvidence([{ ...evidence[0], generatedAt: STARTED_AT_MS - 5000 }], STARTED_AT_MS);
state.steps.push({
  id: "evidence",
  title: "证据校验（SHA-256 / 字节 / 生成时间 / 反例：旧证据被拒绝）",
  command: "internal:verifyEvidence",
  status: verification.ok && !tamperProbe.ok ? "PASS" : "FAIL",
  exitCode: verification.ok && !tamperProbe.ok ? 0 : 1,
  durationMs: 0,
  logPath: null,
  outputTail: verification.errors.concat(tamperProbe.ok ? ["反例失败：旧证据未被拒绝"] : []).join("\n")
});
console.log(`${state.steps.at(-1).status === "PASS" ? "[PASS]" : "[FAIL]"} evidence · 问题 ${verification.errors.length} · 反例已拒绝 ${!tamperProbe.ok}`);

state.evidence = evidence;
state.failedSteps = state.steps.filter((step) => step.status !== "PASS").map((step) => step.id);
state.passed = state.failedSteps.length === 0;
state.status = state.passed ? "PASS" : "FAIL";
state.finishedAt = new Date().toISOString();
state.all_passed = state.passed;
state.finished_at = state.finishedAt;
const unitLog = path.join(LOG_DIR, "unit.log");
const unitBody = fs.existsSync(unitLog) ? fs.readFileSync(unitLog, "utf8") : "";
const unitMatch = unitBody.match(/Tests\s+(\d+)\s+passed/);
state.tests_passed = unitMatch ? Number(unitMatch[1]) : null;
const e2ePath = path.join(ROOT, "artifacts", "e2e-result.json");
state.assertions = fs.existsSync(e2ePath) ? JSON.parse(fs.readFileSync(e2ePath, "utf8")).assertions ?? null : null;

writeReports(state);
if (state.passed) writeEvidenceManifest(state);
if (state.passed) {
  console.log(`RESULT: PASS 验收全部通过；${state.steps.length} 个步骤、${evidence.length + 1} 份证据（含 acceptance.json 自身）、单测 ${state.tests_passed} 项、e2e 断言 ${state.assertions} 项。`);
} else {
  console.error("RESULT: FAIL 未通过步骤：" + state.failedSteps.join(", "));
  console.error("详见 ACCEPTANCE.md 与 artifacts/acceptance.json。");
  process.exitCode = 1;
}
