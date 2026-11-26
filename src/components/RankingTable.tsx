import { useCallback, useMemo, useState } from "react";
import { Table } from "tdesign-react";
import type { PrimaryTableCol, SortInfo } from "tdesign-react";
import { designTokens } from "../designTokens";
import { formatCount, formatMetricValue } from "../domain/format";
import type { MetricDefinition, MetricKey, RankingRow } from "../domain/types";
import { TooltipHelp } from "./TooltipHelp";

interface RankingTableProps {
  rows: RankingRow[];
  definitions: MetricDefinition[];
}

const CATEGORY_TONES: Record<string, string> = {
  "cat-strategy": "#7c3aed",
  "cat-industry": "#0e7490",
  "cat-digital": "#2563eb",
  "cat-brand": "#b45309",
};

export function RankingTable({ rows, definitions }: RankingTableProps) {
  const definitionByKey = useMemo(
    () => new Map(definitions.map((definition) => [definition.key, definition])),
    [definitions],
  );

  const [sort, setSort] = useState<SortInfo>({ sortBy: "enrolled", descending: true });
  const toggleSort = useCallback((colKey: string) => {
    setSort((previous) => {
      const current = Array.isArray(previous) ? previous[0] : previous;
      if (current?.sortBy === colKey) {
        return { sortBy: colKey, descending: !current.descending };
      }
      return { sortBy: colKey, descending: true };
    });
  }, []);

  const sortableLabel = (key: string, label: string) => (
    <button
      type="button"
      className="table-head__label table-head__sort"
      data-testid={"sort-" + key}
      aria-label={"按" + label + "排序"}
      onClick={(event) => {
        event.stopPropagation();
        toggleSort(key);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleSort(key);
        }
      }}
    >
      {label}
    </button>
  );

  const columns = useMemo<PrimaryTableCol<RankingRow>[]>(() => {
    const metricHeader = (key: MetricKey) => {
      const definition = definitionByKey.get(key);
      if (!definition) throw new Error("缺少指标口径定义: " + key);
      return (
        <span className="table-head" data-testid={"th-" + key}>
          {sortableLabel(key, definition.label)}
          <TooltipHelp
            label={definition.label}
            definition={definition.definition}
            comparison={definition.comparison}
            testId={"table-help-" + key}
            compact
          />
        </span>
      );
    };

    return [
      {
        colKey: "courseName",
        title: (
          <span className="table-head" data-testid="th-courseName">
            {sortableLabel("courseName", "课程名")}
          </span>
        ),
        dataIndex: "courseName",
        width: 176,
        ellipsis: true,
        sorter: (a: RankingRow, b: RankingRow) => a.courseName.localeCompare(b.courseName, "zh-CN"),
        cell: ({ row }: { row: RankingRow }) => (
          <span className="course-name" title={row.courseName}>
            {row.courseName}
          </span>
        ),
      },
      {
        colKey: "categoryName",
        title: (
          <span className="table-head" data-testid="th-categoryName">
            {sortableLabel("categoryName", "类别")}
          </span>
        ),
        dataIndex: "categoryName",
        width: 104,
        sorter: (a: RankingRow, b: RankingRow) =>
          a.categoryName.localeCompare(b.categoryName, "zh-CN"),
        cell: ({ row }: { row: RankingRow }) => (
          <span
            className="category-chip"
            style={{ color: CATEGORY_TONES[row.categoryId] ?? designTokens.color.textSecondary }}
          >
            {row.categoryName}
          </span>
        ),
      },
      {
        colKey: "sessionCount",
        title: metricHeader("sessionCount"),
        dataIndex: "sessionCount",
        width: 92,
        align: "right",
        sorter: (a: RankingRow, b: RankingRow) => a.sessionCount - b.sessionCount,
        cell: ({ row }: { row: RankingRow }) => (
          <span className="numeric-cell" data-column="sessionCount" data-value={row.sessionCount}>
            {formatCount(row.sessionCount)}
          </span>
        ),
      },
      {
        colKey: "enrolled",
        title: metricHeader("enrolled"),
        dataIndex: "enrolled",
        width: 96,
        align: "right",
        sorter: (a: RankingRow, b: RankingRow) => a.enrolled - b.enrolled,
        cell: ({ row }: { row: RankingRow }) => (
          <span className="numeric-cell numeric-cell--strong" data-column="enrolled" data-value={row.enrolled}>
            {formatCount(row.enrolled)}
          </span>
        ),
      },
      {
        colKey: "attendanceRate",
        title: metricHeader("attendanceRate"),
        dataIndex: "attendanceRate",
        width: 106,
        align: "right",
        sorter: (a: RankingRow, b: RankingRow) => (a.attendanceRate ?? -1) - (b.attendanceRate ?? -1),
        cell: ({ row }: { row: RankingRow }) => (
          <span
            className="numeric-cell"
            data-column="attendanceRate"
            data-value={row.attendanceRate ?? ""}
          >
            {formatMetricValue(row.attendanceRate, "percent")}
          </span>
        ),
      },
      {
        colKey: "satisfactionAvg",
        title: metricHeader("satisfactionAvg"),
        dataIndex: "satisfactionAvg",
        width: 88,
        align: "right",
        sorter: (a: RankingRow, b: RankingRow) =>
          (a.satisfactionAvg ?? -1) - (b.satisfactionAvg ?? -1),
        cell: ({ row }: { row: RankingRow }) => (
          <span
            className="numeric-cell"
            data-column="satisfactionAvg"
            data-value={row.satisfactionAvg ?? ""}
          >
            {formatMetricValue(row.satisfactionAvg, "score")}
          </span>
        ),
      },
      {
        colKey: "reviewRate",
        title: metricHeader("reviewRate"),
        dataIndex: "reviewRate",
        width: 96,
        align: "right",
        sorter: (a: RankingRow, b: RankingRow) => (a.reviewRate ?? -1) - (b.reviewRate ?? -1),
        cell: ({ row }: { row: RankingRow }) => (
          <span className="numeric-cell" data-column="reviewRate" data-value={row.reviewRate ?? ""}>
            {formatMetricValue(row.reviewRate, "percent")}
          </span>
        ),
      },
      {
        colKey: "nonMemberEnrolled",
        title: metricHeader("nonMemberEnrolled"),
        dataIndex: "nonMemberEnrolled",
        width: 122,
        align: "right",
        sorter: (a: RankingRow, b: RankingRow) => a.nonMemberEnrolled - b.nonMemberEnrolled,
        cell: ({ row }: { row: RankingRow }) => (
          <span
            className="numeric-cell"
            data-column="nonMemberEnrolled"
            data-value={row.nonMemberEnrolled}
          >
            {formatCount(row.nonMemberEnrolled)}
          </span>
        ),
      },
      {
        colKey: "leads",
        title: metricHeader("leads"),
        dataIndex: "leads",
        width: 112,
        align: "right",
        sorter: (a: RankingRow, b: RankingRow) => a.leads - b.leads,
        cell: ({ row }: { row: RankingRow }) => (
          <span className="numeric-cell" data-column="leads" data-value={row.leads}>
            {formatCount(row.leads)}
          </span>
        ),
      },
      {
        colKey: "connections",
        title: metricHeader("connections"),
        dataIndex: "connections",
        width: 118,
        align: "right",
        sorter: (a: RankingRow, b: RankingRow) => a.connections - b.connections,
        cell: ({ row }: { row: RankingRow }) => (
          <span className="numeric-cell" data-column="connections" data-value={row.connections}>
            {formatCount(row.connections)}
          </span>
        ),
      },
    ];
  }, [definitionByKey]);

  const sortedRows = useMemo(() => {
    const sortBy = sort?.sortBy;
    if (!sortBy) return rows;
    const column = columns.find((item) => item.colKey === sortBy);
    const comparator = column?.sorter;
    if (typeof comparator !== "function") return rows;
    const factor = sort.descending ? -1 : 1;
    return [...rows].sort((left, right) => factor * (comparator(left, right) as number));
  }, [rows, sort, columns]);

  return (
    <div className="ranking-table" data-testid="ranking-table" data-rows={rows.length} data-sort-by={sort?.sortBy ?? ""} data-sort-order={sort ? (sort.descending ? "desc" : "asc") : "none"}>
      <Table<RankingRow>
        rowKey="courseId"
        data={sortedRows}
        columns={columns}
        size="small"
        stripe={false}
        hover
        tableLayout="auto"
        sort={sort}
        onSortChange={(info) => setSort(info as SortInfo)}
      />
    </div>
  );
}
