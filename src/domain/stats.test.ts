import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addDays, defaultRange, monthKeysEndingAt, previousPeriod } from "./date";
import { directionOf, formatCount, formatDelta, formatMetricValue } from "./format";
import { buildViewModel } from "./stats";
import type { AcademyDataset, Filters, MetricDefinition, SessionRecord } from "./types";

const TODAY = "2026-11-25";

function readJson<T>(relative: string): T {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const dataset = readJson<AcademyDataset>("../../mock/academy-stats.json");
const definitions = readJson<MetricDefinition[]>("../../mock/metric-definitions.json");
const courseById = new Map(dataset.courses.map((course) => [course.id, course]));
const range = defaultRange(TODAY);
const filters: Filters = { ...range, venueId: "all", categoryId: "all" };

function sessionsIn(start: string, end: string, venueId = "all", categoryId = "all") {
  return dataset.sessions.filter((session) => {
    if (session.date < start || session.date > end) return false;
    if (venueId !== "all" && session.venueId !== venueId) return false;
    const course = courseById.get(session.courseId);
    if (!course) return false;
    if (categoryId !== "all" && course.categoryId !== categoryId) return false;
    return true;
  });
}

function makeSession(overrides: Partial<SessionRecord> & Pick<SessionRecord, "id" | "date">): SessionRecord {
  return {
    courseId: "course-a",
    venueId: "venue-a",
    enrolled: 10,
    attended: 9,
    nonMemberEnrolled: 2,
    completed: 5,
    reviewCount: 4,
    reviewScoreSum: 16,
    leads: 3,
    connections: 2,
    ...overrides,
  };
}

function makeDataset(sessions: SessionRecord[]): AcademyDataset {
  return {
    meta: {
      name: "synthetic",
      title: "synthetic",
      fictional: true,
      asOf: TODAY,
      generatedAt: TODAY,
      generator: "stats.test.ts",
      seed: 1,
      note: "test fixture",
    },
    venues: [{ id: "venue-a", name: "会所 A", city: "上海", status: "active" }],
    categories: [{ id: "cat-a", name: "类别 A" }],
    courses: [{ id: "course-a", name: "课程 A", categoryId: "cat-a", kind: "series" }],
    sessions,
  };
}

function naiveSnapshot(start: string, end: string, venueId = "all", categoryId = "all") {
  const sessions = sessionsIn(start, end, venueId, categoryId);
  const total = (field: "enrolled" | "attended" | "nonMemberEnrolled" | "reviewCount" | "reviewScoreSum" | "leads" | "connections") =>
    sessions.reduce((sum, session) => sum + session[field], 0);
  const bootcampSessions = sessions.filter(
    (session) => courseById.get(session.courseId)?.kind === "bootcamp",
  );
  const completed = bootcampSessions.reduce((sum, session) => sum + session.completed, 0);
  const bootcampEnrolled = bootcampSessions.reduce((sum, session) => sum + session.enrolled, 0);
  const attended = total("attended");
  const enrolled = total("enrolled");
  const reviewCount = total("reviewCount");
  const reviewScoreSum = total("reviewScoreSum");
  return {
    sessionCount: sessions.length,
    enrolled,
    attended,
    attendanceRate: (attended / enrolled) * 100,
    bootcampCompletionRate: (completed / bootcampEnrolled) * 100,
    satisfactionAvg: reviewScoreSum / reviewCount,
    reviewRate: (reviewCount / attended) * 100,
    connections: total("connections"),
    leads: total("leads"),
    nonMemberEnrolled: total("nonMemberEnrolled"),
  };
}

describe("date helpers", () => {
  it("derives the default 90 day window and the equal-length previous window", () => {
    expect(range).toEqual({ start: "2026-08-28", end: "2026-11-25" });
    const previous = previousPeriod(range.start, range.end);
    expect(previous).toEqual({ start: "2026-05-30", end: "2026-08-27" });
    expect(previousPeriod(addDays(TODAY, -29), TODAY)).toEqual({
      start: "2026-09-27",
      end: "2026-10-26",
    });
    expect(monthKeysEndingAt(TODAY, 12)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });
});

describe("metric cards", () => {
  it("recomputes every card from raw session rows, not from precomputed values", () => {
    const view = buildViewModel(dataset, filters, definitions, TODAY);
    const current = naiveSnapshot(range.start, range.end);
    const previous = naiveSnapshot(
      previousPeriod(range.start, range.end).start,
      previousPeriod(range.start, range.end).end,
    );
    const card = (key: string) => {
      const found = view.cards.find((item) => item.key === key);
      if (!found) throw new Error("missing card " + key);
      return found;
    };

    expect(view.sessionCount).toBe(current.sessionCount);
    expect(card("effectiveRegistrations").numeric).toBe(current.enrolled);
    expect(card("effectiveRegistrations").previousNumeric).toBe(previous.enrolled);
    expect(card("attendanceRate").numeric).toBe(Number(current.attendanceRate.toFixed(1)));
    expect(card("attendanceRate").delta).toBe(
      Number((current.attendanceRate - previous.attendanceRate).toFixed(1)),
    );
    expect(card("bootcampCompletionRate").numeric).toBe(
      Number(current.bootcampCompletionRate.toFixed(1)),
    );
    expect(card("satisfactionAvg").numeric).toBe(Number(current.satisfactionAvg.toFixed(2)));
    expect(card("reviewRate").numeric).toBe(Number(current.reviewRate.toFixed(1)));
    expect(card("courseConnections").numeric).toBe(current.connections);
    expect(view.cards).toHaveLength(6);
    for (const item of view.cards) {
      expect(item.definition.length).toBeGreaterThan(10);
      expect(item.comparison.length).toBeGreaterThan(5);
    }
  });

  it("treats a previous period without sessions as no comparison data", () => {
    const view = buildViewModel(
      makeDataset([makeSession({ id: "s1", date: TODAY, enrolled: 10, attended: 9 })]),
      { start: TODAY, end: TODAY, venueId: "all", categoryId: "all" },
      definitions,
      TODAY,
    );
    expect(view.cards).toHaveLength(6);
    for (const card of view.cards) {
      expect(card.previousNumeric).toBeNull();
      expect(card.previousDisplay).toBe("—");
      expect(card.delta).toBeNull();
      expect(card.deltaDisplay).toBe("—");
      expect(card.direction).toBe("none");
    }
  });

  it("computes bootcamp completion from bootcamp sessions only", () => {
    const view = buildViewModel(dataset, filters, definitions, TODAY);
    const card = view.cards.find((item) => item.key === "bootcampCompletionRate");
    const sessions = sessionsIn(range.start, range.end);
    const allCompleted = sessions.reduce((sum, session) => sum + session.completed, 0);
    const allEnrolled = sessions.reduce((sum, session) => sum + session.enrolled, 0);
    const naiveAll = Number(((allCompleted / allEnrolled) * 100).toFixed(1));
    expect(card?.numeric).not.toBe(naiveAll);
    expect(card?.numeric).toBe(Number(naiveSnapshot(range.start, range.end).bootcampCompletionRate.toFixed(1)));
  });
});

describe("trend", () => {
  it("produces the last twelve natural months from the raw data", () => {
    const view = buildViewModel(dataset, filters, definitions, TODAY);
    expect(view.trend).toHaveLength(12);
    expect(view.trend[0].month).toBe("2025-12");
    expect(view.trend[11].month).toBe("2026-11");
    for (const point of view.trend) {
      const monthSessions = dataset.sessions.filter((session) => session.date.startsWith(point.month));
      const enrolled = monthSessions.reduce((sum, session) => sum + session.enrolled, 0);
      const attended = monthSessions.reduce((sum, session) => sum + session.attended, 0);
      expect(point.enrollment).toBe(enrolled);
      expect(point.attendanceRate).toBe(Number(((attended / enrolled) * 100).toFixed(1)));
    }
  });
});

describe("ranking", () => {
  it("aggregates by course and reconciles with the metric cards", () => {
    const view = buildViewModel(dataset, filters, definitions, TODAY);
    expect(view.ranking).toHaveLength(dataset.courses.length);
    expect(view.ranking.reduce((sum, row) => sum + row.enrolled, 0)).toBe(
      view.cards.find((card) => card.key === "effectiveRegistrations")?.numeric,
    );
    expect(view.ranking.reduce((sum, row) => sum + row.sessionCount, 0)).toBe(view.sessionCount);
    for (const row of view.ranking) {
      const course = courseById.get(row.courseId);
      expect(row.courseName).toBe(course?.name);
      expect(row.categoryName).toBe(
        dataset.categories.find((category) => category.id === course?.categoryId)?.name,
      );
      expect(row.enrolled).toBeGreaterThan(0);
      expect(row.attendanceRate).toBeGreaterThan(0);
      if (row.reviewRate !== null) expect(row.reviewRate).toBeLessThanOrEqual(100);
      if (row.satisfactionAvg !== null) {
        expect(row.satisfactionAvg).toBeGreaterThanOrEqual(1);
        expect(row.satisfactionAvg).toBeLessThanOrEqual(5);
      }
    }
    for (let index = 1; index < view.ranking.length; index += 1) {
      expect(view.ranking[index - 1].enrolled).toBeGreaterThanOrEqual(view.ranking[index].enrolled);
    }
  });

  it("leaves review rate empty when nobody attended", () => {
    const view = buildViewModel(
      makeDataset([makeSession({ id: "s1", date: TODAY, enrolled: 5, attended: 0, reviewCount: 0 })]),
      { start: TODAY, end: TODAY, venueId: "all", categoryId: "all" },
      definitions,
      TODAY,
    );
    expect(view.ranking).toHaveLength(1);
    expect(view.ranking[0].attendanceRate).toBe(0);
    expect(view.ranking[0].reviewRate).toBeNull();
  });
});

describe("filters and empty state", () => {
  it("changes all three blocks when the venue changes", () => {
    const all = buildViewModel(dataset, filters, definitions, TODAY);
    const venue = buildViewModel(
      dataset,
      { ...filters, venueId: "venue-hill" },
      definitions,
      TODAY,
    );
    expect(venue.cards[0].numeric).not.toBe(all.cards[0].numeric);
    expect(venue.trend.map((point) => point.enrollment)).not.toEqual(
      all.trend.map((point) => point.enrollment),
    );
    expect(venue.ranking.map((row) => row.courseId).sort()).not.toEqual(
      all.ranking.map((row) => row.courseId).sort(),
    );
    expect(venue.hasData).toBe(true);
  });

  it("keeps months without sessions in the trend instead of dropping them", () => {
    const view = buildViewModel(
      makeDataset([makeSession({ id: "s1", date: TODAY, enrolled: 10, attended: 9 })]),
      { start: "2026-01-01", end: TODAY, venueId: "all", categoryId: "all" },
      definitions,
      TODAY,
    );
    expect(view.trend).toHaveLength(12);
    const currentMonth = view.trend.find((point) => point.month === "2026-11");
    expect(currentMonth?.enrollment).toBe(10);
    expect(currentMonth?.attendanceRate).toBe(90);
    const emptyMonths = view.trend.filter((point) => point.month !== "2026-11");
    expect(emptyMonths).toHaveLength(11);
    for (const point of emptyMonths) {
      expect(point.enrollment).toBe(0);
      expect(point.attendanceRate).toBeNull();
    }
  });

  it("keeps the 12-month trend when the selected range has no sessions", () => {
    const emptyRange = buildViewModel(
      dataset,
      { ...filters, start: "2026-09-01", end: "2026-09-02" },
      definitions,
      TODAY,
    );
    expect(emptyRange.hasData).toBe(false);
    expect(emptyRange.trend).toHaveLength(12);
    expect(emptyRange.trend.some((point) => point.enrollment > 0)).toBe(true);
  });

  it("returns an empty view model for a venue without sessions", () => {
    const empty = buildViewModel(dataset, { ...filters, venueId: "venue-cove" }, definitions, TODAY);
    expect(empty.hasData).toBe(false);
    expect(empty.sessionCount).toBe(0);
    expect(empty.ranking).toEqual([]);
    for (const card of empty.cards) {
      expect(card.numeric).toBeNull();
      expect(card.delta).toBeNull();
      expect(card.deltaDisplay).toBe("—");
      expect(card.direction).toBe("none");
    }
    expect(empty.trend.every((point) => point.enrollment === 0)).toBe(true);
  });

  it("filters the ranking and cards by course category", () => {
    const categoryId = "cat-digital";
    const view = buildViewModel(dataset, { ...filters, categoryId }, definitions, TODAY);
    const categoryName = dataset.categories.find((category) => category.id === categoryId)?.name;
    expect(view.ranking.length).toBeGreaterThan(0);
    expect(view.ranking.every((row) => row.categoryName === categoryName)).toBe(true);
    const naive = naiveSnapshot(range.start, range.end, "all", categoryId);
    expect(view.cards[0].numeric).toBe(naive.enrolled);
    expect(view.sessionCount).toBe(naive.sessionCount);
  });
});

describe("formatting", () => {
  it("formats counts, rates, scores and deltas consistently", () => {
    expect(formatCount(1788)).toBe("1,788");
    expect(formatMetricValue(85.57, "percent")).toBe("85.6%");
    expect(formatMetricValue(null, "score")).toBe("—");
    expect(formatDelta(-114, "count")).toBe("-114");
    expect(formatDelta(1.94, "percent")).toBe("+1.9pp");
    expect(formatDelta(-0.044, "score")).toBe("-0.04");
    expect(formatDelta(0, "count")).toBe("0");
    expect(directionOf(-0.4)).toBe("down");
    expect(directionOf(0)).toBe("flat");
    expect(directionOf(null)).toBe("none");
  });
});
