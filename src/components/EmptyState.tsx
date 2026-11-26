interface EmptyStateProps {
  block: "metrics" | "trend" | "ranking";
  title?: string;
  hint?: string;
}

export function EmptyState({ block, title, hint }: EmptyStateProps) {
  return (
    <div
      className="empty-state"
      data-testid="empty-state"
      data-block={block}
      role="status"
      aria-live="polite"
    >
      <div className="empty-state__mark" aria-hidden="true">
        ∅
      </div>
      <p className="empty-state__title">{title ?? "暂无运营数据"}</p>
      <p className="empty-state__hint">
        {hint ?? "当前筛选条件下没有课期记录，请调整时间段、会所或课程类别。"}
      </p>
    </div>
  );
}
