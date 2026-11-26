import datasetJson from "../../mock/academy-stats.json";
import definitionsJson from "../../mock/metric-definitions.json";
import type { AcademyDataset, MetricDefinition } from "../domain/types";

export interface AcademyStatsPayload {
  dataset: AcademyDataset;
  definitions: MetricDefinition[];
  source: "mock";
  fetchedAt: string;
}

const mockDataset = datasetJson as unknown as AcademyDataset;
const mockDefinitions = definitionsJson as unknown as MetricDefinition[];

/**
 * 学院运营数据接口（当前为 mock）。
 *
 * 对接真实接口时，请替换此函数为：
 *   GET /api/v1/academy/stats?start=YYYY-MM-DD&end=YYYY-MM-DD&venue_id=...&category_id=...
 * 并保持返回结构 { dataset, definitions }；数据范围由 S2-IAM 的 data scope 注入。
 * 详见 README「Mock 接口与对接点」。
 */
export async function fetchAcademyStats(): Promise<AcademyStatsPayload> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return {
    dataset: mockDataset,
    definitions: mockDefinitions,
    source: "mock",
    fetchedAt: new Date().toISOString(),
  };
}
