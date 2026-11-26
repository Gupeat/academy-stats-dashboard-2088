import { useEffect, useMemo, useState } from "react";
import { fetchAcademyStats, type AcademyStatsPayload } from "../api/academyStats";
import { EmptyState } from "../components/EmptyState";
import { FilterBar } from "../components/FilterBar";
import { MetricCard } from "../components/MetricCard";
import { RankingTable } from "../components/RankingTable";
import { TrendChart } from "../components/TrendChart";
import { defaultRange, toIsoDate } from "../domain/date";
import { buildViewModel, trendPeriodLabel } from "../domain/stats";
import type { Filters } from "../domain/types";

function todayIso(): string {
  return toIsoDate(new Date());
}

export function AcademyStatsPage() {
  const [payload, setPayload] = useState<AcademyStatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => {
    const range = defaultRange(todayIso());
    return { ...range, venueId: "all", categoryId: "all" };
  });

  useEffect(() => {
    let disposed = false;
    fetchAcademyStats()
      .then((result) => {
        if (!disposed) setPayload(result);
      })
      .catch((reason: unknown) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : "运营数据加载失败");
      });
    return () => {
      disposed = true;
    };
  }, []);

  const today = todayIso();
  const view = useMemo(
    () => (payload ? buildViewModel(payload.dataset, filters, payload.definitions, today) : null),
    [payload, filters, today],
  );

  if (error) {
    return (
      <div className="page-shell">
        <div className="page-error panel" data-testid="page-error" role="alert">
          <h1>学院运营数据加载失败</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!payload || !view) {
    return (
      <div className="page-shell">
        <div className="page-loading panel" data-testid="page-loading" role="status">
          正在加载学院运营数据…
        </div>
      </div>
    );
  }

  const venues = payload.dataset.venues;
  const categories = payload.dataset.categories;
  const observedAt = payload.dataset.meta.asOf;
  const rangeText = view.range.start + " 至 " + view.range.end;
  const previousText = view.previousRange.start + " 至 " + view.previousRange.end;
  const hasData = view.hasData;
  const trendHasData = view.trend.some((point) => point.enrollment > 0 || point.attendanceRate !== null);

  const patchFilters = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="page-shell" data-testid="page-root">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">学院 v1 · 工作台</p>
          <h1 className="page-title">学院运营数据</h1>
          <p className="page-subtitle">
            统计周期 {rangeText}（与上一同等长度周期 {previousText} 对比）· 趋势固定展示最近 12 个自然月
          </p>
        </div>
        <div className="page-header__meta">
          <span className="data-badge" data-testid="data-source" data-source={payload.source}>
            虚构演示数据 · {observedAt} 快照
          </span>
        </div>
      </header>

      <FilterBar
        filters={filters}
        venues={venues}
        categories={categories}
        today={today}
        onChange={patchFilters}
        onReset={() => {
          const range = defaultRange(todayIso());
          setFilters({ ...range, venueId: "all", categoryId: "all" });
        }}
      />

      <section className="section" aria-labelledby="metrics-heading" data-testid="metrics-section">
        <div className="section-head">
          <h2 id="metrics-heading" className="section-title">
            核心指标
          </h2>
          <p className="section-note">6 项指标均与上一同等长度时间段对比，会所与课程类别筛选保持一致</p>
        </div>
        {hasData ? (
          <div className="stats-grid" data-testid="metrics-grid">
            {view.cards.map((card) => (
              <MetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <EmptyState block="metrics" title="暂无指标数据" />
        )}
      </section>

      <section className="section panel" aria-labelledby="trend-heading" data-testid="trend-section">
        <div className="section-head">
          <div>
            <h2 id="trend-heading" className="section-title">
              报名与出勤趋势
            </h2>
            <p className="section-note">
              {trendHasData
                ? trendPeriodLabel(view.trend) + " · 左轴报名数，右轴出勤率"
                : "最近 12 个自然月 · 左轴报名数，右轴出勤率"}
            </p>
          </div>
          <span className="section-tag">近 12 个月</span>
        </div>
        {trendHasData ? (
          <TrendChart points={view.trend} />
        ) : (
          <EmptyState block="trend" title="暂无趋势数据" />
        )}
      </section>

      <section className="section panel" aria-labelledby="ranking-heading" data-testid="ranking-section">
        <div className="section-head">
          <div>
            <h2 id="ranking-heading" className="section-title">
              课程排行
            </h2>
            <p className="section-note">
              {hasData
                ? "当前周期共 " +
                  view.sessionCount +
                  " 个课期、" +
                  view.ranking.length +
                  " 门课程 · 点击表头切换排序"
                : "点击表头可排序，当前筛选条件下暂无课程"}
            </p>
          </div>
          <span className="section-tag">按课程聚合</span>
        </div>
        {hasData ? (
          <RankingTable rows={view.ranking} definitions={payload.definitions} />
        ) : (
          <EmptyState block="ranking" title="暂无课程排行数据" />
        )}
      </section>

      <footer className="page-footer">
        <span>数据口径与接口对接点见 README「运营数据接口口径表」「Mock 接口与对接点」。</span>
        <span>演示数据均为虚构，不含真实企业或个人信息。</span>
      </footer>
    </div>
  );
}
