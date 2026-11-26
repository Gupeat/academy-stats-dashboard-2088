#!/usr/bin/env node
/**
 * 独立口径校验器：只读 mock/academy-stats.json 与 mock/metric-definitions.json，
 * 不 import src/domain/*，用纯 JS 重算 6 张指标卡、上一同等周期、12 个月趋势与课程排行。
 *
 * 用法：
 *   node scripts/check-stats.mjs            # 校验 + 输出 artifacts/expected-stats.json
 *   node scripts/check-stats.mjs --self-test # 篡改输入，必须被拒绝（退出码非 0 视为失败）
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOCK_PATH = path.join(ROOT, "mock", "academy-stats.json");
const DEF_PATH = path.join(ROOT, "mock", "metric-definitions.json");
const OUT_PATH = path.join(ROOT, "artifacts", "expected-stats.json");
const TODAY = "2026-11-25";

const CARD_KEYS = [
  "effectiveRegistrations",
  "attendanceRate",
  "bootcampCompletionRate",
  "satisfactionAvg",
  "reviewRate",
  "courseConnections"
];
const TABLE_KEYS = ["sessionCount", "nonMemberEnrolled", "leads"];

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const DAY_MS = 86400000;
const pad = (value) => String(value).padStart(2, "0");
function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
}
function daysInclusive(start, end) {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  return Math.floor((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS) + 1;
}
function previousPeriod(start, end) {
  const length = daysInclusive(start, end);
  const previousEnd = addDays(start, -1);
  return { start: addDays(previousEnd, -(length - 1)), end: previousEnd };
}
function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
function monthKeysEndingAt(today, count) {
  const [y, m] = today.split("-").map(Number);
  const base = y * 12 + (m - 1);
  const keys = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const index = base - offset;
    keys.push(Math.floor(index / 12) + "-" + pad((index % 12) + 1));
  }
  return keys;
}

const roundTo = (value, digits) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const digitsFor = (unit) => (unit === "count" ? 0 : unit === "percent" ? 1 : 2);
const formatMetric = (value, unit) => {
  if (value === null || !Number.isFinite(value)) return "—";
  if (unit === "count") return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
  return value.toFixed(digitsFor(unit)) + (unit === "percent" ? "%" : "");
};
const formatDelta = (value, unit) => {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "-";
  const abs = Math.abs(value);
  return sign + abs.toFixed(digitsFor(unit)) + (unit === "percent" ? "pp" : "");
};
const directionOf = (value) => (value === null ? "none" : value > 0 ? "up" : value < 0 ? "down" : "flat");

/**
 * 数据完整性校验：返回错误列表。所有检查都从原始 JSON 出发，不读页面或报告。
 */
function validate(dataset, definitions) {
  const errors = [];
  const courseIds = new Set();
  const categoryIds = new Set(dataset.categories.map((item) => item.id));
  const venueIds = new Set(dataset.venues.map((item) => item.id));

  if (dataset.meta?.fictional !== true) errors.push("meta.fictional 必须为 true（合成数据标注）");
  for (const course of dataset.courses) {
    if (courseIds.has(course.id)) errors.push("课程 id 重复: " + course.id);
    courseIds.add(course.id);
    if (!categoryIds.has(course.categoryId)) errors.push("课程类别不存在: " + course.id);
    if (!["series", "bootcamp"].includes(course.kind)) errors.push("课程类型非法: " + course.id);
  }
  const sessionIds = new Set();
  for (const session of dataset.sessions) {
    const id = session.id ?? "(missing)";
    if (sessionIds.has(id)) errors.push("课期 id 重复: " + id);
    sessionIds.add(id);
    if (!courseIds.has(session.courseId)) errors.push("课期引用未知课程: " + id);
    if (!venueIds.has(session.venueId)) errors.push("课期引用未知会所: " + id);
    if (!isValidIsoDate(session.date ?? "")) errors.push("课期日期非法: " + id);
    for (const field of ["enrolled", "attended", "nonMemberEnrolled", "completed", "reviewCount", "reviewScoreSum", "leads", "connections"]) {
      if (!Number.isInteger(session[field]) || session[field] < 0) errors.push("课期字段非法: " + id + "." + field);
    }
    if (session.attended > session.enrolled) errors.push("出勤大于报名: " + id);
    if (session.completed > session.enrolled) errors.push("完课大于报名: " + id);
    if (session.reviewCount > session.attended) errors.push("评价份数大于出勤: " + id);
    if (session.reviewScoreSum > session.reviewCount * 5) errors.push("评价总分超过 5 分制上限: " + id);
    if (session.reviewScoreSum < session.reviewCount) errors.push("评价总分低于 1 分制下限: " + id);
    if (session.nonMemberEnrolled > session.enrolled) errors.push("非会员报名大于总报名: " + id);
  }
  const byKey = new Map(definitions.map((item) => [item.key, item]));
  for (const key of [...CARD_KEYS, ...TABLE_KEYS]) {
    const definition = byKey.get(key);
    if (!definition) {
      errors.push("缺少指标口径: " + key);
      continue;
    }
    if (typeof definition.definition !== "string" || definition.definition.length < 20) {
      errors.push("指标口径说明过短: " + key);
    }
    const isCard = CARD_KEYS.includes(key);
    if (typeof definition.comparison !== "string" || definition.comparison.length < 6) {
      errors.push("指标对比口径缺失: " + key);
    } else if (isCard && !definition.comparison.includes("上一")) {
      errors.push("卡片指标缺少上一周期对比口径: " + key);
    } else if (!isCard && !/当前周期|环比/.test(definition.comparison)) {
      errors.push("表格指标缺少展示范围说明: " + key);
    }
  }
  const cardUnits = { effectiveRegistrations: "count", attendanceRate: "percent", bootcampCompletionRate: "percent", satisfactionAvg: "score", reviewRate: "percent", courseConnections: "count" };
  for (const [key, unit] of Object.entries(cardUnits)) {
    if (byKey.get(key)?.unit !== unit) errors.push("指标单位不符: " + key);
  }
  return errors;
}

function totalsOf(sessions, courseById) {
  const totals = {
    sessionCount: 0, enrolled: 0, attended: 0, nonMemberEnrolled: 0,
    completed: 0, bootcampEnrolled: 0, bootcampCompleted: 0,
    reviewCount: 0, reviewScoreSum: 0, leads: 0, connections: 0
  };
  for (const session of sessions) {
    totals.sessionCount += 1;
    totals.enrolled += session.enrolled;
    totals.attended += session.attended;
    totals.nonMemberEnrolled += session.nonMemberEnrolled;
    totals.completed += session.completed;
    totals.reviewCount += session.reviewCount;
    totals.reviewScoreSum += session.reviewScoreSum;
    totals.leads += session.leads;
    totals.connections += session.connections;
    const course = courseById.get(session.courseId);
    if (course?.kind === "bootcamp") {
      totals.bootcampEnrolled += session.enrolled;
      totals.bootcampCompleted += session.completed;
    }
  }
  return totals;
}

const ratio = (part, whole) => (whole <= 0 ? null : (part / whole) * 100);
const average = (total, count) => (count <= 0 ? null : total / count);

function snapshotOf(totals) {
  return {
    effectiveRegistrations: totals.enrolled,
    attendanceRate: ratio(totals.attended, totals.enrolled),
    bootcampCompletionRate: ratio(totals.bootcampCompleted, totals.bootcampEnrolled),
    satisfactionAvg: average(totals.reviewScoreSum, totals.reviewCount),
    reviewRate: ratio(totals.reviewCount, totals.attended),
    courseConnections: totals.connections,
    sessionCount: totals.sessionCount,
    nonMemberEnrolled: totals.nonMemberEnrolled,
    leads: totals.leads
  };
}

function computeCase(dataset, definitions, { start, end, venueId = "all", categoryId = "all" }) {
  const courseById = new Map(dataset.courses.map((course) => [course.id, course]));
  const categoryNameById = new Map(dataset.categories.map((category) => [category.id, category.name]));
  const previousRange = previousPeriod(start, end);
  const current = [];
  const previous = [];
  for (const session of dataset.sessions) {
    if (venueId !== "all" && session.venueId !== venueId) continue;
    const course = courseById.get(session.courseId);
    if (!course) continue;
    if (categoryId !== "all" && course.categoryId !== categoryId) continue;
    if (session.date >= start && session.date <= end) current.push(session);
    else if (session.date >= previousRange.start && session.date <= previousRange.end) previous.push(session);
  }
  const currentTotals = totalsOf(current, courseById);
  const previousTotals = totalsOf(previous, courseById);
  const currentSnapshot = snapshotOf(currentTotals);
  const previousSnapshot = snapshotOf(previousTotals);
  const byKey = new Map(definitions.map((item) => [item.key, item]));
  const hasData = currentTotals.sessionCount > 0;
  const cards = CARD_KEYS.map((key) => {
    const definition = byKey.get(key);
    const digits = digitsFor(definition.unit);
    const rawCurrent = currentSnapshot[key];
    // 上一周期没有任何课期时，所有指标都视为“无上一周期数据”，不能把 0 当成真实对比基数。
    const rawPrevious = previousTotals.sessionCount > 0 ? previousSnapshot[key] : null;
    const rawDelta = hasData && rawCurrent !== null && rawPrevious !== null ? rawCurrent - rawPrevious : null;
    const numeric = hasData && rawCurrent !== null ? roundTo(rawCurrent, digits) : null;
    const previousNumeric = hasData && rawPrevious !== null ? roundTo(rawPrevious, digits) : null;
    const delta = rawDelta === null ? null : roundTo(rawDelta, digits);
    return {
      key,
      label: definition.label,
      unit: definition.unit,
      numeric,
      display: formatMetric(numeric, definition.unit),
      previousNumeric,
      previousDisplay: formatMetric(previousNumeric, definition.unit),
      delta,
      deltaDisplay: formatDelta(delta, definition.unit),
      direction: directionOf(delta)
    };
  });

  const months = monthKeysEndingAt(TODAY, 12);
  const bucket = new Map(months.map((month) => [month, { enrolled: 0, attended: 0 }]));
  for (const session of dataset.sessions) {
    if (venueId !== "all" && session.venueId !== venueId) continue;
    const course = courseById.get(session.courseId);
    if (!course) continue;
    if (categoryId !== "all" && course.categoryId !== categoryId) continue;
    const entry = bucket.get(session.date.slice(0, 7));
    if (!entry) continue;
    entry.enrolled += session.enrolled;
    entry.attended += session.attended;
  }
  const trend = months.map((month) => {
    const entry = bucket.get(month);
    return {
      month,
      enrollment: entry.enrolled,
      attendanceRate: entry.enrolled === 0 ? null : roundTo(ratio(entry.attended, entry.enrolled), 1)
    };
  });

  const accumulators = new Map();
  for (const session of current) {
    const course = courseById.get(session.courseId);
    let entry = accumulators.get(course.id);
    if (!entry) {
      entry = {
        courseId: course.id, courseName: course.name,
        categoryId: course.categoryId, categoryName: categoryNameById.get(course.categoryId) ?? "未分类",
        sessionCount: 0, enrolled: 0, attended: 0, reviewCount: 0, reviewScoreSum: 0,
        nonMemberEnrolled: 0, leads: 0, connections: 0
      };
      accumulators.set(course.id, entry);
    }
    entry.sessionCount += 1;
    entry.enrolled += session.enrolled;
    entry.attended += session.attended;
    entry.reviewCount += session.reviewCount;
    entry.reviewScoreSum += session.reviewScoreSum;
    entry.nonMemberEnrolled += session.nonMemberEnrolled;
    entry.leads += session.leads;
    entry.connections += session.connections;
  }
  const ranking = [...accumulators.values()].map((entry) => ({
    courseId: entry.courseId,
    courseName: entry.courseName,
    categoryName: entry.categoryName,
    sessionCount: entry.sessionCount,
    enrolled: entry.enrolled,
    attendanceRate: entry.attended === 0 && entry.enrolled === 0 ? null : roundTo(ratio(entry.attended, entry.enrolled) ?? 0, 1),
    satisfactionAvg: entry.reviewCount === 0 ? null : roundTo(average(entry.reviewScoreSum, entry.reviewCount) ?? 0, 2),
    reviewRate: entry.attended === 0 ? null : roundTo((entry.reviewCount / entry.attended) * 100, 1),
    nonMemberEnrolled: entry.nonMemberEnrolled,
    leads: entry.leads,
    connections: entry.connections
  }));
  ranking.sort((left, right) => (right.enrolled !== left.enrolled ? right.enrolled - left.enrolled : left.courseName.localeCompare(right.courseName, "zh-CN")));

  return {
    range: { start, end },
    previousRange,
    hasData,
    sessionCount: currentTotals.sessionCount,
    cards,
    trend,
    ranking
  };
}

function main() {
  const dataset = readJson(MOCK_PATH);
  const definitions = readJson(DEF_PATH);
  const errors = validate(dataset, definitions);

  if (process.argv.includes("--self-test")) {
    const tampers = [
      ["出勤大于报名", (data, defs) => { data.sessions[0].attended = data.sessions[0].enrolled + 1; return defs; }],
      ["评价总分超过 5 分制上限", (data, defs) => { data.sessions[0].reviewScoreSum = data.sessions[0].reviewCount * 5 + 1; return defs; }],
      ["课期 id 重复", (data, defs) => { data.sessions[1].id = data.sessions[0].id; return defs; }],
      ["引用未知课程", (data, defs) => { data.sessions[0].courseId = "course-missing"; return defs; }],
      ["删除指标口径", (data, defs) => defs.filter((item) => item.key !== "reviewRate")]
    ];
    let failures = 0;
    for (const [label, tamper] of tampers) {
      const data = JSON.parse(JSON.stringify(dataset));
      const defs = JSON.parse(JSON.stringify(definitions));
      const tamperedDefs = tamper(data, defs);
      const found = validate(data, tamperedDefs);
      const rejected = found.length > 0;
      if (!rejected) failures += 1;
      console.log((rejected ? "PASS" : "FAIL") + " 反例被拒绝：" + label + (rejected ? " → " + found[0] : "（未被拒绝）"));
    }
    if (failures > 0) {
      console.error("FAIL self-test：" + failures + " 个反例未被拒绝");
      process.exitCode = 1;
      return;
    }
    console.log("RESULT: PASS self-test 5/5 反例被独立校验器拒绝");
    return;
  }

  if (errors.length > 0) {
    console.error("FAIL 数据校验未通过：");
    for (const error of errors.slice(0, 20)) console.error(" - " + error);
    process.exitCode = 1;
    return;
  }

  const cases = {
    default: computeCase(dataset, definitions, { start: addDays(TODAY, -89), end: TODAY }),
    venueHill: computeCase(dataset, definitions, { start: addDays(TODAY, -89), end: TODAY, venueId: "venue-hill" }),
    venueCove: computeCase(dataset, definitions, { start: addDays(TODAY, -89), end: TODAY, venueId: "venue-cove" }),
    categoryStrategy: computeCase(dataset, definitions, { start: addDays(TODAY, -89), end: TODAY, categoryId: "cat-strategy" }),
    last30: computeCase(dataset, definitions, { start: addDays(TODAY, -29), end: TODAY })
  };

  const payload = {
    today: TODAY,
    timezone: "Asia/Shanghai",
    source: {
      mock: "mock/academy-stats.json",
      mockSha256: sha256(MOCK_PATH),
      definitions: "mock/metric-definitions.json",
      definitionsSha256: sha256(DEF_PATH),
      sessions: dataset.sessions.length,
      courses: dataset.courses.length
    },
    definitions: definitions.map((item) => ({ key: item.key, label: item.label, unit: item.unit })),
    cases
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + "\n");

  const base = cases.default;
  console.log("独立重算完成 → artifacts/expected-stats.json");
  console.log("课期 " + dataset.sessions.length + " · 默认区间 " + base.range.start + ".." + base.range.end + " · 课期数 " + base.sessionCount + " · 排行 " + base.ranking.length + " 门课程");
  for (const card of base.cards) {
    console.log("  " + card.label + " = " + card.display + "（上一周期 " + card.previousDisplay + "，" + card.deltaDisplay + "）");
  }
  console.log("RESULT: PASS 数据校验与独立重算通过");
}

main();
