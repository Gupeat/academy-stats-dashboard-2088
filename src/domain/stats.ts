import {
  daysInclusive,
  monthKeysEndingAt,
  monthLabel,
  monthLabelLong,
  previousPeriod,
  type Range,
} from "./date";
import {
  digitsFor,
  directionOf,
  formatDelta,
  formatMetricValue,
  roundTo,
} from "./format";
import type {
  AcademyDataset,
  CardMetricKey,
  Course,
  Filters,
  MetricCardView,
  MetricDefinition,
  RankingRow,
  SessionRecord,
  TableMetricKey,
  TrendPoint,
  ViewModel,
} from "./types";

export const CARD_KEYS: CardMetricKey[] = [
  "effectiveRegistrations",
  "attendanceRate",
  "bootcampCompletionRate",
  "satisfactionAvg",
  "reviewRate",
  "courseConnections",
];

export const TABLE_METRIC_KEYS: TableMetricKey[] = ["enrolled", "connections", "sessionCount", "nonMemberEnrolled", "leads"];

interface Totals {
  sessionCount: number;
  enrolled: number;
  attended: number;
  nonMemberEnrolled: number;
  completed: number;
  bootcampEnrolled: number;
  bootcampCompleted: number;
  reviewCount: number;
  reviewScoreSum: number;
  leads: number;
  connections: number;
}

type Snapshot = Record<CardMetricKey | TableMetricKey, number | null>;

function emptyTotals(): Totals {
  return {
    sessionCount: 0,
    enrolled: 0,
    attended: 0,
    nonMemberEnrolled: 0,
    completed: 0,
    bootcampEnrolled: 0,
    bootcampCompleted: 0,
    reviewCount: 0,
    reviewScoreSum: 0,
    leads: 0,
    connections: 0,
  };
}

function ratio(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return (part / whole) * 100;
}

function average(total: number, count: number): number | null {
  if (count <= 0) return null;
  return total / count;
}

function accumulate(totals: Totals, session: SessionRecord, course: Course | undefined): void {
  totals.sessionCount += 1;
  totals.enrolled += session.enrolled;
  totals.attended += session.attended;
  totals.nonMemberEnrolled += session.nonMemberEnrolled;
  totals.completed += session.completed;
  totals.reviewCount += session.reviewCount;
  totals.reviewScoreSum += session.reviewScoreSum;
  totals.leads += session.leads;
  totals.connections += session.connections;
  if (course && course.kind === "bootcamp") {
    totals.bootcampEnrolled += session.enrolled;
    totals.bootcampCompleted += session.completed;
  }
}

function sumSessions(sessions: SessionRecord[], courseById: Map<string, Course>): Totals {
  const totals = emptyTotals();
  for (const session of sessions) {
    accumulate(totals, session, courseById.get(session.courseId));
  }
  return totals;
}

function snapshotOf(totals: Totals): Snapshot {
  return {
    effectiveRegistrations: totals.enrolled,
    attendanceRate: ratio(totals.attended, totals.enrolled),
    bootcampCompletionRate: ratio(totals.bootcampCompleted, totals.bootcampEnrolled),
    satisfactionAvg: average(totals.reviewScoreSum, totals.reviewCount),
    reviewRate: ratio(totals.reviewCount, totals.attended),
    courseConnections: totals.connections,
    enrolled: totals.enrolled,
    connections: totals.connections,
    sessionCount: totals.sessionCount,
    nonMemberEnrolled: totals.nonMemberEnrolled,
    leads: totals.leads,
  };
}

function buildCards(
  current: Snapshot,
  previous: Snapshot,
  definitions: MetricDefinition[],
): MetricCardView[] {
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  return CARD_KEYS.map((key) => {
    const definition = byKey.get(key);
    if (!definition) throw new Error("缺少指标口径定义: " + key);
    const unit = definition.unit;
    const rawCurrent = current[key];
    // 上一周期没有任何课期时，所有指标都视为“无上一周期数据”，不能把 0 当成真实对比基数。
    const rawPrevious = (previous.sessionCount ?? 0) > 0 ? previous[key] : null;
    const digits = digitsFor(unit);
    const numeric = rawCurrent === null ? null : roundTo(rawCurrent, digits);
    const previousNumeric = rawPrevious === null ? null : roundTo(rawPrevious, digits);
    const rawDelta =
      rawCurrent === null || rawPrevious === null ? null : rawCurrent - rawPrevious;
    const delta = rawDelta === null ? null : roundTo(rawDelta, digits);
    return {
      key,
      label: definition.label,
      unit,
      numeric,
      display: formatMetricValue(numeric, unit),
      previousNumeric,
      previousDisplay: formatMetricValue(previousNumeric, unit),
      delta,
      deltaDisplay: formatDelta(delta, unit),
      direction: directionOf(delta),
      definition: definition.definition,
      comparison: definition.comparison,
    };
  });
}

interface RankingAccumulator {
  courseId: string;
  courseName: string;
  categoryId: string;
  categoryName: string;
  sessionCount: number;
  enrolled: number;
  attended: number;
  reviewCount: number;
  reviewScoreSum: number;
  nonMemberEnrolled: number;
  leads: number;
  connections: number;
}

function buildRanking(
  sessions: SessionRecord[],
  courseById: Map<string, Course>,
  categoryNameById: Map<string, string>,
): RankingRow[] {
  const accumulatorById = new Map<string, RankingAccumulator>();
  for (const session of sessions) {
    const course = courseById.get(session.courseId);
    if (!course) continue;
    let entry = accumulatorById.get(course.id);
    if (!entry) {
      entry = {
        courseId: course.id,
        courseName: course.name,
        categoryId: course.categoryId,
        categoryName: categoryNameById.get(course.categoryId) ?? "未分类",
        sessionCount: 0,
        enrolled: 0,
        attended: 0,
        reviewCount: 0,
        reviewScoreSum: 0,
        nonMemberEnrolled: 0,
        leads: 0,
        connections: 0,
      };
      accumulatorById.set(course.id, entry);
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

  const rows: RankingRow[] = [];
  for (const entry of accumulatorById.values()) {
    rows.push({
      courseId: entry.courseId,
      courseName: entry.courseName,
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      sessionCount: entry.sessionCount,
      enrolled: entry.enrolled,
      attendanceRate:
        entry.attended === 0 && entry.enrolled === 0
          ? null
          : roundTo(ratio(entry.attended, entry.enrolled) ?? 0, 1),
      satisfactionAvg:
        entry.reviewCount === 0
          ? null
          : roundTo(average(entry.reviewScoreSum, entry.reviewCount) ?? 0, 2),
      reviewRate:
        entry.attended === 0 ? null : roundTo((entry.reviewCount / entry.attended) * 100, 1),
      nonMemberEnrolled: entry.nonMemberEnrolled,
      leads: entry.leads,
      connections: entry.connections,
    });
  }
  rows.sort((left, right) => {
    if (right.enrolled !== left.enrolled) return right.enrolled - left.enrolled;
    return left.courseName.localeCompare(right.courseName, "zh-CN");
  });
  return rows;
}

function buildTrend(
  dataset: AcademyDataset,
  filters: Filters,
  courseById: Map<string, Course>,
  today: string,
): TrendPoint[] {
  const months = monthKeysEndingAt(today, 12);
  const bucket = new Map<string, { enrolled: number; attended: number }>();
  for (const month of months) bucket.set(month, { enrolled: 0, attended: 0 });

  for (const session of dataset.sessions) {
    if (filters.venueId !== "all" && session.venueId !== filters.venueId) continue;
    const course = courseById.get(session.courseId);
    if (!course) continue;
    if (filters.categoryId !== "all" && course.categoryId !== filters.categoryId) continue;
    const month = session.date.slice(0, 7);
    const entry = bucket.get(month);
    if (!entry) continue;
    entry.enrolled += session.enrolled;
    entry.attended += session.attended;
  }

  return months.map((month) => {
    const entry = bucket.get(month) ?? { enrolled: 0, attended: 0 };
    return {
      month,
      label: monthLabel(month),
      enrollment: entry.enrolled,
      attendanceRate:
        entry.enrolled === 0 ? null : roundTo(ratio(entry.attended, entry.enrolled) ?? 0, 1),
    };
  });
}

export function buildViewModel(
  dataset: AcademyDataset,
  inputFilters: Filters,
  definitions: MetricDefinition[],
  today: string,
): ViewModel {
  const courseById = new Map(dataset.courses.map((course) => [course.id, course]));
  const categoryNameById = new Map(dataset.categories.map((category) => [category.id, category.name]));

  const start = inputFilters.start <= inputFilters.end ? inputFilters.start : inputFilters.end;
  const end = inputFilters.start <= inputFilters.end ? inputFilters.end : inputFilters.start;
  const filters: Filters = { ...inputFilters, start, end };
  const range: Range = { start, end };
  const previousRange = previousPeriod(start, end);
  const daySpan = daysInclusive(start, end);

  const currentSessions: SessionRecord[] = [];
  const previousSessions: SessionRecord[] = [];
  for (const session of dataset.sessions) {
    if (filters.venueId !== "all" && session.venueId !== filters.venueId) continue;
    const course = courseById.get(session.courseId);
    if (!course) continue;
    if (filters.categoryId !== "all" && course.categoryId !== filters.categoryId) continue;
    if (session.date >= start && session.date <= end) {
      currentSessions.push(session);
    } else if (session.date >= previousRange.start && session.date <= previousRange.end) {
      previousSessions.push(session);
    }
  }

  const currentTotals = sumSessions(currentSessions, courseById);
  const previousTotals = sumSessions(previousSessions, courseById);
  const currentSnapshot = snapshotOf(currentTotals);
  const previousSnapshot = snapshotOf(previousTotals);
  const builtCards = buildCards(currentSnapshot, previousSnapshot, definitions);
  // 当前区间没有任何课期时，整块视为“无数据”：所有卡片显示「—」，不展示 0 或上一周期值，避免误导。
  const cards =
    currentTotals.sessionCount === 0
      ? builtCards.map((card) => ({
          ...card,
          numeric: null,
          display: "—",
          previousNumeric: null,
          previousDisplay: "—",
          delta: null,
          deltaDisplay: "—",
          direction: "none" as const,
        }))
      : builtCards;
  const trend = buildTrend(dataset, filters, courseById, today);
  const ranking = buildRanking(currentSessions, courseById, categoryNameById);

  return {
    range,
    previousRange,
    sessionCount: currentTotals.sessionCount,
    hasData: currentTotals.sessionCount > 0 && daySpan > 0,
    cards,
    trend,
    ranking,
  };
}

export function trendPeriodLabel(points: TrendPoint[]): string {
  if (points.length === 0) return "";
  return monthLabelLong(points[0].month) + " – " + monthLabelLong(points[points.length - 1].month);
}
