import { useState, type ReactNode } from "react";
import { Tooltip } from "tdesign-react";

interface TooltipHelpProps {
  label: string;
  definition: string;
  comparison: string;
  previous?: string;
  testId?: string;
  compact?: boolean;
}

export function TooltipHelp({
  label,
  definition,
  comparison,
  previous,
  testId,
  compact,
}: TooltipHelpProps) {
  // TDesign 的 trigger 只支持单一方式；用受控 visible 同时覆盖 hover 与键盘 focus。
  const [visible, setVisible] = useState(false);
  const content: ReactNode = (
    <div className="tooltip-body">
      <p className="tooltip-body__title">{label} · 口径说明</p>
      <p className="tooltip-body__text">{definition}</p>
      <p className="tooltip-body__meta">对比口径：{comparison}</p>
      {previous ? <p className="tooltip-body__meta">上一周期：{previous}</p> : null}
    </div>
  );

  return (
    <Tooltip
      content={content}
      placement="top"
      theme={compact ? "default" : "light"}
      delay={[0, 0]}
      showArrow
      visible={visible}
      onVisibleChange={(next) => setVisible(next)}
    >
      <button
        type="button"
        className={compact ? "metric-help metric-help--compact" : "metric-help"}
        aria-label={"查看" + label + "口径说明"}
        aria-expanded={visible}
        data-testid={testId ?? "metric-help"}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setVisible(false);
        }}
        onClick={(event) => event.stopPropagation()}
      >
        ?
      </button>
    </Tooltip>
  );
}
