export type CourseKind = "series" | "bootcamp";

export interface Venue {
  id: string;
  name: string;
  city: string;
  status: "active" | "preparing";
}

export interface Category {
  id: string;
  name: string;
}

export interface Course {
  id: string;
  name: string;
  categoryId: string;
  kind: CourseKind;
}

export interface SessionRecord {
  id: string;
  courseId: string;
  venueId: string;
  date: string;
  enrolled: number;
  attended: number;
  nonMemberEnrolled: number;
  completed: number;
  reviewCount: number;
  reviewScoreSum: number;
  leads: number;
  connections: number;
}

export interface DatasetMeta {
  name: string;
  title: string;
  fictional: boolean;
  asOf: string;
  generatedAt: string;
  generator: string;
  seed: number;
  note: string;
}

export interface AcademyDataset {
  meta: DatasetMeta;
  venues: Venue[];
  categories: Category[];
  courses: Course[];
  sessions: SessionRecord[];
}

export type MetricScope = "cards" | "table";
export type MetricUnit = "count" | "percent" | "score";
export type CardMetricKey =
  | "effectiveRegistrations"
  | "attendanceRate"
  | "bootcampCompletionRate"
  | "satisfactionAvg"
  | "reviewRate"
  | "courseConnections";
export type TableMetricKey = "enrolled" | "connections" | "sessionCount" | "nonMemberEnrolled" | "leads";
export type MetricKey = CardMetricKey | TableMetricKey;

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: MetricUnit;
  appliesTo: MetricScope[];
  definition: string;
  comparison: string;
}

export interface Filters {
  start: string;
  end: string;
  venueId: string;
  categoryId: string;
}

export type Direction = "up" | "down" | "flat" | "none";

export interface MetricCardView {
  key: CardMetricKey;
  label: string;
  unit: MetricUnit;
  numeric: number | null;
  display: string;
  previousNumeric: number | null;
  previousDisplay: string;
  delta: number | null;
  deltaDisplay: string;
  direction: Direction;
  definition: string;
  comparison: string;
}

export interface TrendPoint {
  month: string;
  label: string;
  enrollment: number;
  attendanceRate: number | null;
}

export interface RankingRow {
  courseId: string;
  courseName: string;
  categoryId: string;
  categoryName: string;
  sessionCount: number;
  enrolled: number;
  attendanceRate: number | null;
  satisfactionAvg: number | null;
  reviewRate: number | null;
  nonMemberEnrolled: number;
  leads: number;
  connections: number;
}

export interface Range {
  start: string;
  end: string;
}

export interface ViewModel {
  range: Range;
  previousRange: Range;
  sessionCount: number;
  hasData: boolean;
  cards: MetricCardView[];
  trend: TrendPoint[];
  ranking: RankingRow[];
}
