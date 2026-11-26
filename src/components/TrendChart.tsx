import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { designTokens } from "../designTokens";
import { monthLabel, monthLabelLong } from "../domain/date";
import { formatCount, formatPercentValue } from "../domain/format";
import type { TrendPoint } from "../domain/types";

interface TrendChartProps {
  points: TrendPoint[];
}

export function TrendChart({ points }: TrendChartProps) {
  const rates = points
    .map((point) => point.attendanceRate)
    .filter((rate): rate is number => rate !== null);
  const minRate = rates.length > 0 ? Math.max(0, Math.floor((Math.min(...rates) - 4) / 5) * 5) : 70;
  const lastPoint = points[points.length - 1];
  const totalEnrollment = points.reduce((sum, point) => sum + point.enrollment, 0);
  const ariaSummary =
    "最近 12 个月报名数趋势与出勤率双轴折线图，" +
    monthLabelLong(points[0] ? points[0].month : "") +
    " 至 " +
    monthLabelLong(lastPoint ? lastPoint.month : "") +
    "，合计报名 " +
    formatCount(totalEnrollment) +
    " 人，最新月份出勤率 " +
    (lastPoint && lastPoint.attendanceRate !== null
      ? formatPercentValue(lastPoint.attendanceRate)
      : "无数据");

  const option = {
    animation: false,
    color: [designTokens.color.chartEnrollment, designTokens.color.chartAttendance],
    textStyle: { fontFamily: designTokens.font.family, color: designTokens.color.textSecondary },
    tooltip: {
      trigger: "axis",
      backgroundColor: designTokens.color.panel,
      borderColor: designTokens.color.border,
      textStyle: { color: designTokens.color.text, fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: designTokens.color.borderStrong } },
    },
    legend: {
      data: ["报名数", "出勤率"],
      top: 0,
      right: 8,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: designTokens.color.textSecondary, fontSize: 12 },
    },
    grid: { left: 56, right: 64, top: 46, bottom: 30 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: points.map((point) => point.month),
      axisLine: { lineStyle: { color: designTokens.color.border } },
      axisTick: { show: false },
      axisLabel: {
        color: designTokens.color.textMuted,
        fontSize: 11,
        formatter: (value: string) => monthLabel(value),
      },
    },
    yAxis: [
      {
        type: "value",
        name: "报名数",
        min: 0,
        nameTextStyle: { color: designTokens.color.textMuted, fontSize: 11 },
        axisLabel: { color: designTokens.color.textMuted, fontSize: 11 },
        splitLine: { lineStyle: { color: designTokens.color.chartGrid, type: "dashed" } },
      },
      {
        type: "value",
        name: "出勤率 (%)",
        min: minRate,
        max: 100,
        nameTextStyle: { color: designTokens.color.textMuted, fontSize: 11 },
        axisLabel: { color: designTokens.color.chartAttendance, fontSize: 11, formatter: "{value}%" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "报名数",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        data: points.map((point) => point.enrollment),
        lineStyle: { width: 2.5, color: designTokens.color.chartEnrollment },
        itemStyle: { color: designTokens.color.chartEnrollment },
        areaStyle: { color: "rgba(37, 99, 235, 0.08)" },
        tooltip: { valueFormatter: (value: number) => formatCount(value) + " 人" },
      },
      {
        name: "出勤率",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        connectNulls: false,
        data: points.map((point) => point.attendanceRate),
        lineStyle: { width: 2.5, color: designTokens.color.chartAttendance, type: "dashed" },
        itemStyle: { color: designTokens.color.chartAttendance },
        tooltip: {
          valueFormatter: (value: number | null) =>
            value === null || value === undefined ? "—" : formatPercentValue(Number(value)),
        },
      },
    ],
  } as EChartsOption;

  return (
    <div className="trend-chart" data-testid="trend-chart">
      <div role="img" aria-label={ariaSummary}>
        <ReactECharts option={option} style={{ height: 300, width: "100%" }} notMerge lazyUpdate />
      </div>
      <table className="sr-only" data-testid="trend-data" data-months={points.length}>
        <caption>最近 12 个月报名数与出勤率数据明细</caption>
        <thead>
          <tr>
            <th scope="col">月份</th>
            <th scope="col">报名数</th>
            <th scope="col">出勤率</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr
              key={point.month}
              data-month={point.month}
              data-enrollment={point.enrollment}
              data-attendance={point.attendanceRate === null ? "" : point.attendanceRate}
            >
              <th scope="row">{monthLabelLong(point.month)}</th>
              <td>{formatCount(point.enrollment)}</td>
              <td>{point.attendanceRate === null ? "—" : formatPercentValue(point.attendanceRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
