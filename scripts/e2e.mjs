#!/usr/bin/env node
/**
 * 端到端验收：Playwright + 固定时钟 + 1440 宽视口，逐条比对 artifacts/expected-stats.json
 * （由独立脚本 scripts/check-stats.mjs 从 mock JSON 重算，不 import 页面代码）。
 *
 * 用法：
 *   node scripts/e2e.mjs --fast       # 断言 + 截图
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { findBrowser } from "./find-browser.mjs";
import { startPreview } from "./preview-server.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_PATH = path.join(ROOT, "artifacts", "expected-stats.json");
const SCREEN_DIR = path.join(ROOT, "docs", "screens");
const RESULT_PATH = path.join(ROOT, "artifacts", "e2e-result.json");
const FIXED_TIME = new Date("2026-11-25T10:00:00+08:00");

if (!fs.existsSync(EXPECTED_PATH)) {
  console.error("FAIL 缺少 artifacts/expected-stats.json，请先运行 node scripts/check-stats.mjs");
  process.exit(1);
}
const expected = JSON.parse(fs.readFileSync(EXPECTED_PATH, "utf8"));
fs.mkdirSync(SCREEN_DIR, { recursive: true });

let assertions = 0;
const failures = [];
function check(condition, message) {
  assertions += 1;
  if (!condition) failures.push(message);
  if (!condition) console.log("  [FAIL] " + message);
}

const screenshots = [];
async function shot(page, name, options = {}) {
  const file = path.join(SCREEN_DIR, name);
  await page.screenshot({ path: file, ...options });
  const body = fs.readFileSync(file);
  const entry = {
    path: "docs/screens/" + name,
    sha256: crypto.createHash("sha256").update(body).digest("hex"),
    bytes: body.length,
    generatedAt: Math.round(fs.statSync(file).mtimeMs)
  };
  screenshots.push(entry);
  return entry;
}

const preview = await startPreview();
const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
  timezoneId: "Asia/Shanghai",
  locale: "zh-CN"
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(String(error)));

const cardsOf = () =>
  page.$$eval('[data-testid="metric-card"]', (elements) =>
    elements.map((element) => ({
      key: element.getAttribute("data-metric-key"),
      value: element.getAttribute("data-value"),
      display: element.getAttribute("data-display"),
      previous: element.getAttribute("data-previous"),
      delta: element.getAttribute("data-delta"),
      deltaDisplay: element.getAttribute("data-delta-display"),
      direction: element.getAttribute("data-direction")
    }))
  );

const trendOf = () =>
  page.$$eval('[data-testid="trend-data"] tbody tr', (rows) =>
    rows.map((row) => ({
      month: row.getAttribute("data-month"),
      enrollment: Number(row.getAttribute("data-enrollment")),
      attendance: row.getAttribute("data-attendance") === "" ? null : Number(row.getAttribute("data-attendance"))
    }))
  );

const rankingOf = () =>
  page.$$eval('[data-testid="ranking-table"] tbody tr', (rows) =>
    rows.map((row) => {
      const cells = {};
      for (const cell of row.querySelectorAll("[data-column]")) {
        cells[cell.getAttribute("data-column")] = cell.getAttribute("data-value");
      }
      const nameCell = row.querySelector(".course-name");
      return { name: nameCell ? nameCell.textContent : "", ...cells };
    })
  );

const numberOrNull = (value) => (value === "" || value === null || value === undefined ? null : Number(value));

function compareCards(actual, expectedCase, label) {
  check(actual.length === 6, label + "：应渲染 6 张指标卡，实际 " + actual.length);
  const expectedByKey = new Map(expectedCase.cards.map((card) => [card.key, card]));
  for (const card of actual) {
    const want = expectedByKey.get(card.key);
    if (!want) {
      check(false, label + "：出现未知指标卡 " + card.key);
      continue;
    }
    check(numberOrNull(card.value) === want.numeric, label + "：" + want.label + " 当前值应为 " + want.numeric + "，实际 " + card.value);
    check(numberOrNull(card.previous) === want.previousNumeric, label + "：" + want.label + " 上一周期应为 " + want.previousNumeric + "，实际 " + card.previous);
    check(numberOrNull(card.delta) === want.delta, label + "：" + want.label + " 变化值应为 " + want.delta + "，实际 " + card.delta);
    check(card.deltaDisplay === want.deltaDisplay, label + "：" + want.label + " 变化展示应为 " + want.deltaDisplay + "，实际 " + card.deltaDisplay);
    check(card.direction === want.direction, label + "：" + want.label + " 箭头方向应为 " + want.direction + "，实际 " + card.direction);
    check(card.display === want.display, label + "：" + want.label + " 展示值应为 " + want.display + "，实际 " + card.display);
  }
}

function compareTrend(actual, expectedCase, label) {
  check(actual.length === 12, label + "：趋势应为 12 个月，实际 " + actual.length);
  expectedCase.trend.forEach((want, index) => {
    const got = actual[index];
    if (!got) return;
    check(got.month === want.month, label + "：第 " + (index + 1) + " 个月份应为 " + want.month + "，实际 " + got.month);
    check(got.enrollment === want.enrollment, label + "：" + want.month + " 报名数应为 " + want.enrollment + "，实际 " + got.enrollment);
    check(got.attendance === want.attendanceRate, label + "：" + want.month + " 出勤率应为 " + want.attendanceRate + "，实际 " + got.attendance);
  });
}

function compareRanking(actual, expectedCase, label) {
  check(actual.length === expectedCase.ranking.length, label + "：排行行数应为 " + expectedCase.ranking.length + "，实际 " + actual.length);
  expectedCase.ranking.forEach((want, index) => {
    const got = actual[index];
    if (!got) return;
    check(got.name.trim() === want.courseName, label + "：第 " + (index + 1) + " 行课程应为 " + want.courseName + "，实际 " + got.name.trim());
    check(Number(got.enrolled) === want.enrolled, label + "：" + want.courseName + " 报名数应为 " + want.enrolled + "，实际 " + got.enrolled);
    check(Number(got.sessionCount) === want.sessionCount, label + "：" + want.courseName + " 课期数应为 " + want.sessionCount + "，实际 " + got.sessionCount);
    check(numberOrNull(got.attendanceRate) === want.attendanceRate, label + "：" + want.courseName + " 出勤率应为 " + want.attendanceRate + "，实际 " + got.attendanceRate);
    check(numberOrNull(got.satisfactionAvg) === want.satisfactionAvg, label + "：" + want.courseName + " 均分应为 " + want.satisfactionAvg + "，实际 " + got.satisfactionAvg);
    check(numberOrNull(got.reviewRate) === want.reviewRate, label + "：" + want.courseName + " 评价率应为 " + want.reviewRate + "，实际 " + got.reviewRate);
    check(Number(got.leads) === want.leads, label + "：" + want.courseName + " 线索数应为 " + want.leads + "，实际 " + got.leads);
    check(Number(got.connections) === want.connections, label + "：" + want.courseName + " 连接数应为 " + want.connections + "，实际 " + got.connections);
    check(Number(got.nonMemberEnrolled) === want.nonMemberEnrolled, label + "：" + want.courseName + " 非会员报名应为 " + want.nonMemberEnrolled + "，实际 " + got.nonMemberEnrolled);
  });
}

const filterState = () =>
  page.locator('[data-testid="filter-bar"]').evaluate((element) => ({
    start: element.getAttribute("data-range-start"),
    end: element.getAttribute("data-range-end"),
    venue: element.getAttribute("data-venue"),
    category: element.getAttribute("data-category"),
    quick: element.getAttribute("data-quick")
  }));

async function waitForFilter(predicate) {
  await page.waitForFunction((expectedState) => {
    const element = document.querySelector('[data-testid="filter-bar"]');
    if (!element) return false;
    return Object.entries(expectedState).every(([key, value]) => {
      const attribute = { start: "data-range-start", end: "data-range-end", venue: "data-venue", category: "data-category", quick: "data-quick" }[key];
      return element.getAttribute(attribute) === value;
    });
  }, predicate);
}

async function chooseOption(selectTestId, optionText, expectedFilters) {
  await page.locator('[data-testid="' + selectTestId + '"] .t-select').click();
  const option = page.locator(".t-select-option", { hasText: optionText }).first();
  await option.waitFor({ state: "visible" });
  await option.click();
  await waitForFilter(expectedFilters);
  await page.waitForTimeout(250);
}

try {
  await page.clock.install({ time: FIXED_TIME });
  await page.goto(preview.url, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="page-root"]');
  await page.waitForTimeout(300);

  const base = expected.cases.default;

  // 1. 默认筛选与整体结构
  const initialFilters = await filterState();
  check(initialFilters.start === base.range.start, "默认开始日期应为 " + base.range.start + "，实际 " + initialFilters.start);
  check(initialFilters.end === base.range.end, "默认结束日期应为 " + base.range.end + "，实际 " + initialFilters.end);
  check(initialFilters.venue === "all", "默认会所应为 all，实际 " + initialFilters.venue);
  check(initialFilters.category === "all", "默认类别应为 all，实际 " + initialFilters.category);
  check(initialFilters.quick === "90", "默认快捷区间应为 90 天，实际 " + initialFilters.quick);
  check((await page.locator('[data-testid="th-courseName"]').count()) === 1, "排行表应存在课程名列");
  const headerCount = await page.locator('[data-testid="ranking-table"] thead th').count();
  check(headerCount === 10, "排行表应为 10 列，实际 " + headerCount);

  // 2. 6 张指标卡 + 上一周期 + 箭头
  compareCards(await cardsOf(), base, "默认区间");

  // 3. 12 个月双轴趋势（隐藏数据表与 ECharts 同源）
  compareTrend(await trendOf(), base, "默认区间");
  check((await page.locator('[data-testid="trend-chart"] canvas').count()) === 1, "趋势图应渲染 ECharts canvas");
  const chartLabel = await page.locator('[data-testid="trend-chart"] [role="img"]').getAttribute("aria-label");
  check(/最近 12 个月.*双轴/.test(chartLabel ?? ""), "趋势图应有可访问摘要，实际 " + chartLabel);

  // 4. 排行表 10 列 + 默认按报名数倒序
  compareRanking(await rankingOf(), base, "默认区间");
  const defaultOrder = (await rankingOf()).map((row) => Number(row.enrolled));
  check(defaultOrder.every((value, index) => index === 0 || defaultOrder[index - 1] >= value), "默认排行应按报名数倒序，实际 " + defaultOrder.join(","));

  // 5. AC1：默认页面截图（1440 宽，整页）
  const ac1 = await shot(page, "ac1-academy-stats.png", { fullPage: true });
  check(ac1.bytes > 40000, "AC1 截图应包含实际渲染内容，实际 " + ac1.bytes + " 字节");

  // 6. 问号提示：未 hover 不显示，hover 后显示口径说明
  check((await page.locator(".t-tooltip:visible").count()) === 0, "未 hover 时不应出现口径浮层");
  await page.locator('[data-testid="metric-help-effectiveRegistrations"]').hover();
  await page.locator(".t-tooltip").first().waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  const tooltipText = await page.locator(".t-tooltip").first().innerText();
  check(tooltipText.includes("口径说明"), "指标提示应包含「口径说明」，实际 " + tooltipText.slice(0, 60));
  check(tooltipText.includes("有效报名数"), "指标提示应包含指标名，实际 " + tooltipText.slice(0, 60));
  check(tooltipText.includes("对比口径"), "指标提示应包含对比口径，实际 " + tooltipText.slice(0, 60));
  const ac2 = await shot(page, "ac2-metric-tooltip.png");
  check(ac2.bytes > 30000, "AC2 截图应包含浮层，实际 " + ac2.bytes + " 字节");
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);

  // 6b. 键盘 focus 也必须显示口径浮层，不能只支持鼠标 hover
  await page.locator('[data-testid="metric-help-effectiveRegistrations"]').focus();
  await page.locator(".t-tooltip").first().waitFor({ state: "visible" });
  check(
    (await page.locator(".t-tooltip").first().innerText()).includes("有效报名数"),
    "键盘 focus 问号时应显示指标口径",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check((await page.locator(".t-tooltip:visible").count()) === 0, "按 Escape 后口径浮层应关闭");

  const tableHelp = page.locator('[data-testid="table-help-sessionCount"]');
  await tableHelp.hover();
  await page.locator(".t-tooltip").first().waitFor({ state: "visible" });
  check((await page.locator(".t-tooltip").first().innerText()).includes("课期数"), "表头问号应显示课期数口径");
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  for (const [key, label] of [["enrolled", "报名数"], ["connections", "带来连接数"]]) {
    await page.locator('[data-testid="table-help-' + key + '"]').hover();
    await page.locator(".t-tooltip").first().waitFor({ state: "visible" });
    check((await page.locator(".t-tooltip").first().innerText()).includes(label), "表头问号应显示" + label + "口径");
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
  }

  // 7. 排序：箭头按钮切换升序 / 降序
  const enrolledHeader = page.locator('th[data-colkey="enrolled"]');
  await enrolledHeader.locator(".t-table-sort-asc").click();
  await page.waitForTimeout(350);
  const ascOrder = (await rankingOf()).map((row) => Number(row.enrolled));
  check(ascOrder.every((value, index) => index === 0 || ascOrder[index - 1] <= value), "点击升序后应按报名数升序，实际 " + ascOrder.join(","));
  check((await page.locator('[data-testid="ranking-table"]').getAttribute("data-sort-order")) === "asc", "排序状态应为 asc");
  await shot(page, "ac1b-ranking-sort-asc.png", { fullPage: true });
  await enrolledHeader.locator(".t-table-sort-desc").click();
  await page.waitForTimeout(350);
  const descOrder = (await rankingOf()).map((row) => Number(row.enrolled));
  check(descOrder.every((value, index) => index === 0 || descOrder[index - 1] >= value), "点击降序后应按报名数降序，实际 " + descOrder.join(","));

  // 7b. 点击表头文字本身也必须排序（不是只有箭头可用）
  await page.locator('[data-testid="sort-enrolled"]').click();
  await page.waitForTimeout(350);
  const textAscOrder = (await rankingOf()).map((row) => Number(row.enrolled));
  check(
    textAscOrder.every((value, index) => index === 0 || textAscOrder[index - 1] <= value),
    "点击表头文字后应按报名数升序，实际 " + textAscOrder.join(","),
  );
  check(
    (await page.locator('[data-testid="ranking-table"]').getAttribute("data-sort-order")) === "asc",
    "点击表头文字后排序状态应为 asc",
  );
  await page.locator('[data-testid="sort-enrolled"]').click();
  await page.waitForTimeout(350);
  check(
    (await page.locator('[data-testid="ranking-table"]').getAttribute("data-sort-order")) === "desc",
    "再次点击表头文字后排序状态应为 desc",
  );

  // 8. 会所筛选：所有区块一起刷新
  const hill = expected.cases.venueHill;
  await chooseOption("venue-filter", "云岭会所", { venue: "venue-hill" });
  compareCards(await cardsOf(), hill, "云岭会所");
  compareTrend(await trendOf(), hill, "云岭会所");
  compareRanking(await rankingOf(), hill, "云岭会所");
  check((await page.locator('[data-testid="ranking-table"]').getAttribute("data-rows")) === String(hill.ranking.length), "会所筛选后排行行数应刷新");
  await shot(page, "ac3a-venue-hill.png", { fullPage: true });

  // 9. 课程类别筛选（先重置会所，验证类别单独生效）
  await page.getByRole("button", { name: "重置筛选" }).click();
  await waitForFilter({ venue: "all", category: "all", quick: "90" });
  await page.waitForTimeout(250);
  const strategy = expected.cases.categoryStrategy;
  await chooseOption("category-filter", "战略与管理", { venue: "all", category: "cat-strategy" });
  compareCards(await cardsOf(), strategy, "战略与管理");
  compareTrend(await trendOf(), strategy, "战略与管理");
  compareRanking(await rankingOf(), strategy, "战略与管理");

  // 10. 30 天快捷区间（先回到默认筛选）
  await page.getByRole("button", { name: "重置筛选" }).click();
  await waitForFilter({ venue: "all", category: "all", quick: "90" });
  await page.waitForTimeout(200);
  const last30 = expected.cases.last30;
  await page.locator(".quick-range").getByText("近 30 天", { exact: true }).click();
  await waitForFilter({ start: last30.range.start, end: last30.range.end, quick: "30" });
  await page.waitForTimeout(250);
  check((await filterState()).quick === "30", "快捷区间应切换为 30 天");
  compareCards(await cardsOf(), { ...last30, cards: last30.cards }, "近 30 天");

  // 11. 空状态：筹备中会所没有任何课期
  await page.getByRole("button", { name: "重置筛选" }).click();
  await waitForFilter({ start: base.range.start, venue: "all", category: "all", quick: "90" });
  await page.waitForTimeout(250);
  await chooseOption("venue-filter", "青屿会所（筹备中）", { venue: "venue-cove" });
  const emptyBlocks = await page.$$eval('[data-testid="empty-state"]', (elements) => elements.map((element) => element.getAttribute("data-block")));
  check(emptyBlocks.length === 3, "空会所应显示 3 个空状态，实际 " + emptyBlocks.length);
  check(["metrics", "trend", "ranking"].every((block) => emptyBlocks.includes(block)), "空状态应覆盖指标/趋势/排行，实际 " + emptyBlocks.join(","));
  check((await page.locator('[data-testid="metric-card"]').count()) === 0, "空会所不应渲染指标卡");
  check((await page.locator('[data-testid="empty-state"]').first().innerText()).includes("调整时间段"), "空状态应给出调整筛选的提示");
  await shot(page, "ac4-empty-state.png", { fullPage: true });

  // 12. 重置回到默认
  await page.getByRole("button", { name: "重置筛选" }).click();
  await waitForFilter({ start: base.range.start, venue: "all", category: "all", quick: "90" });
  await page.waitForTimeout(300);
  compareCards(await cardsOf(), base, "重置后");
  compareRanking(await rankingOf(), base, "重置后");

  // 13. console 无错误
  check(consoleErrors.length === 0, "浏览器 console 不应有错误，实际 " + consoleErrors.slice(0, 3).join(" | "));
} finally {
  await context.close();
  await browser.close();
  await preview.stop();
}

const passed = failures.length === 0;
const result = {
  passed,
  assertions,
  failed: failures.length,
  failures: failures.slice(0, 50),
  fixedTime: FIXED_TIME.toISOString(),
  derivedFrom: "artifacts/expected-stats.json",
  expectedSource: expected.source,
  screenshots,
  consoleErrors,
  finishedAt: new Date().toISOString()
};
fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2) + "\n");

if (!passed) {
  console.error("RESULT: FAIL e2e 断言 " + assertions + " 项，失败 " + failures.length + " 项；详见 artifacts/e2e-result.json");
  process.exit(1);
}
console.log("RESULT: PASS e2e 断言 " + assertions + " 项，截图 " + screenshots.length + " 张。");
console.log("覆盖：默认 90 天 6 卡/12 月双轴/10 列排行、问号口径提示、排序升降序、会所与类别筛选全量刷新、30 天快捷区间、空会所空状态、重置。");
