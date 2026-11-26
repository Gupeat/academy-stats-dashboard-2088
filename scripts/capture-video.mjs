#!/usr/bin/env node
/**
 * AC3 录屏：真实浏览器会话录制（Playwright WebM），固定时钟与 1440×1100 视口，
 * 交互序列：加载 → 问号口径 → 切会所（所有区块刷新）→ 表头排序 → 空会所空状态 → 重置。
 * 产物：docs/recordings/ac3-venue-switch.webm（时长由 probe-webm.mjs 校验 8–15 秒）
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { findBrowser } from "./find-browser.mjs";
import { startPreview } from "./preview-server.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "docs", "recordings");
const TMP_DIR = path.join(ROOT, ".video-tmp");
const OUT_FILE = path.join(OUT_DIR, "ac3-venue-switch.webm");
const RESULT_FILE = path.join(ROOT, "artifacts", "video-result.json");
const FIXED_TIME = new Date("2026-11-25T10:00:00+08:00");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const preview = await startPreview();
const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  timezoneId: "Asia/Shanghai",
  locale: "zh-CN",
  recordVideo: { dir: TMP_DIR, size: { width: 1440, height: 1100 } }
});
const page = await context.newPage();
const video = page.video();

const wait = (ms) => page.waitForTimeout(ms);
async function choose(selectTestId, optionText, expectedVenue) {
  await page.locator('[data-testid="' + selectTestId + '"] .t-select').click();
  const option = page.locator(".t-select-option", { hasText: optionText }).first();
  await option.waitFor({ state: "visible" });
  await option.click();
  await page.waitForFunction((venue) => {
    const element = document.querySelector('[data-testid="filter-bar"]');
    return element && element.getAttribute("data-venue") === venue;
  }, expectedVenue);
  await wait(900);
}

try {
  await page.clock.install({ time: FIXED_TIME });
  await page.goto(preview.url, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="page-root"]');
  await wait(1200);

  await page.locator('[data-testid="metric-help-effectiveRegistrations"]').hover();
  await wait(1400);
  await page.mouse.move(40, 60);
  await wait(400);

  await choose("venue-filter", "云岭会所", "venue-hill");
  await wait(700);

  const header = page.locator('th[data-colkey="enrolled"]');
  await header.locator(".t-table-sort-asc").click();
  await wait(1200);
  await header.locator(".t-table-sort-desc").click();
  await wait(900);
  await page.mouse.wheel(0, 500);
  await wait(700);

  await choose("venue-filter", "青屿会所（筹备中）", "venue-cove");
  await wait(900);

  await page.getByRole("button", { name: "重置筛选" }).click();
  await wait(1100);
  await page.mouse.wheel(0, -500);
  await wait(700);

  await context.close();
  await browser.close();
  await preview.stop();
} catch (error) {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  await preview.stop().catch(() => {});
  throw error;
}

const source = await video.path();
fs.copyFileSync(source, OUT_FILE);
const body = fs.readFileSync(OUT_FILE);
fs.rmSync(TMP_DIR, { recursive: true, force: true });
const result = {
  path: "docs/recordings/ac3-venue-switch.webm",
  sha256: crypto.createHash("sha256").update(body).digest("hex"),
  bytes: body.length,
  generatedAt: Math.round(fs.statSync(OUT_FILE).mtimeMs),
  method: "Playwright recordVideo（Edge headless，1440×1100，固定时钟 2026-11-25T10:00+08:00）",
  interaction: "hover 口径提示 → 云岭会所筛选 → 排序升/降 → 青屿会所空状态 → 重置筛选"
};
fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true });
fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2) + "\n");
console.log("录屏写入 " + result.path + "（" + result.bytes + " 字节）");
console.log("sha256: " + result.sha256);
