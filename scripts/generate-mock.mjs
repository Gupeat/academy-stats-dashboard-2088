// Deterministic fictional demo data for the academy operations dashboard.
// The committed mock/academy-stats.json is the source of truth; this script only
// documents how it was produced. No real companies, people or customer data.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AS_OF = "2026-11-25";
const START_MONTH = "2025-06";
const MONTHS = 18;
const SEED = 20261125;

const venues = [
  { id: "venue-river", name: "滨江会所", city: "上海", status: "active" },
  { id: "venue-hill", name: "云岭会所", city: "杭州", status: "active" },
  { id: "venue-lake", name: "澄湖会所", city: "苏州", status: "active" },
  { id: "venue-cove", name: "青屿会所", city: "宁波", status: "preparing" },
];

const categories = [
  { id: "cat-strategy", name: "战略与管理" },
  { id: "cat-industry", name: "产业对接" },
  { id: "cat-digital", name: "数字运营" },
  { id: "cat-brand", name: "品牌增长" },
];

const courses = [
  { id: "course-01", name: "增长战略工作坊", categoryId: "cat-strategy", kind: "series" },
  { id: "course-02", name: "组织韧性研修班", categoryId: "cat-strategy", kind: "series" },
  { id: "course-03", name: "供应链协同营", categoryId: "cat-industry", kind: "bootcamp" },
  { id: "course-04", name: "产业对接闭门会", categoryId: "cat-industry", kind: "series" },
  { id: "course-05", name: "数据看板实战", categoryId: "cat-digital", kind: "series" },
  { id: "course-06", name: "智能提效训练营", categoryId: "cat-digital", kind: "bootcamp" },
  { id: "course-07", name: "私域运营进阶", categoryId: "cat-digital", kind: "series" },
  { id: "course-08", name: "品牌叙事工作坊", categoryId: "cat-brand", kind: "series" },
  { id: "course-09", name: "内容增长实验室", categoryId: "cat-brand", kind: "series" },
  { id: "course-10", name: "客户成功方法论", categoryId: "cat-strategy", kind: "series" },
  { id: "course-11", name: "渠道生态沙盘", categoryId: "cat-industry", kind: "series" },
  { id: "course-12", name: "会员体验设计", categoryId: "cat-brand", kind: "series" },
];

// mulberry32: tiny deterministic PRNG so the fixture is reproducible.
function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pad = (value) => String(value).padStart(2, "0");

function monthKey(offset) {
  const base = new Date(Date.UTC(2025, 5, 1));
  const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
  return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1);
}

const sessions = [];
for (let month = 0; month < MONTHS; month += 1) {
  const key = monthKey(month);
  for (let venueIndex = 0; venueIndex < 3; venueIndex += 1) {
    const start = (month * 3 + venueIndex * 5) % courses.length;
    for (let slot = 0; slot < 5; slot += 1) {
      const course = courses[(start + slot * 2) % courses.length];
      const day = 4 + slot * 5 + ((month * 2 + venueIndex) % 4);
      const date = key + "-" + pad(day);
      if (date < START_MONTH + "-01" || date > AS_OF) continue;

      const enrolled = 16 + Math.floor(rand() * 24) + Math.floor(month * 0.8) + venueIndex * 2;
      const attendance = clamp(0.78 + rand() * 0.13 + venueIndex * 0.008, 0.74, 0.96);
      const attended = Math.max(1, Math.round(enrolled * attendance));
      const nonMemberEnrolled = Math.round(enrolled * (0.08 + rand() * 0.16));
      const reviewParticipation = 0.52 + rand() * 0.3;
      const reviewCount = Math.min(attended, Math.round(attended * reviewParticipation));
      const average = clamp(4.15 + rand() * 0.6 + venueIndex * 0.03, 4.0, 4.9);
      const reviewScoreSum = clamp(Math.round(reviewCount * average), reviewCount, reviewCount * 5);
      const leads = Math.round(enrolled * (0.06 + rand() * 0.1)) + (venueIndex === 1 ? 1 : 0);
      const connections = Math.round(enrolled * (0.22 + rand() * 0.3));
      const completed =
        course.kind === "bootcamp" ? Math.round(enrolled * (0.52 + rand() * 0.25)) : 0;

      sessions.push({
        id: "sess-" + String(sessions.length + 1).padStart(4, "0"),
        courseId: course.id,
        venueId: venues[venueIndex].id,
        date,
        enrolled,
        attended,
        nonMemberEnrolled,
        completed,
        reviewCount,
        reviewScoreSum,
        leads,
        connections,
      });
    }
  }
}

sessions.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));

const dataset = {
  meta: {
    name: "academy-stats",
    title: "学院运营数据（虚构演示数据）",
    fictional: true,
    asOf: AS_OF,
    generatedAt: AS_OF + "T09:00:00+08:00",
    generator: "scripts/generate-mock.mjs",
    seed: SEED,
    note: "所有会所、课程与数值均为虚构演示数据，不含任何真实企业或个人信息。",
  },
  venues,
  categories,
  courses,
  sessions,
};

mkdirSync(resolve(ROOT, "mock"), { recursive: true });
writeFileSync(resolve(ROOT, "mock", "academy-stats.json"), JSON.stringify(dataset, null, 2) + "\n", "utf8");
const bootcamps = sessions.filter((session) => courses.find((course) => course.id === session.courseId).kind === "bootcamp");
console.log(
  JSON.stringify(
    {
      sessions: sessions.length,
      bootcampSessions: bootcamps.length,
      firstDate: sessions[0]?.date,
      lastDate: sessions[sessions.length - 1]?.date,
      totalEnrolled: sessions.reduce((sum, session) => sum + session.enrolled, 0),
    },
    null,
    2,
  ),
);
