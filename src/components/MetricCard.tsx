import { formatMetricValue } from "../domain/format";
import type { Direction, MetricCardView } from "../domain/types";
import { TooltipHelp } from "./TooltipHelp";

const ARROW: Record<Direction, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
  none: "–",
};

const DIRECTION_TEXT: Record<Direction, string> = {
  up: "较上一周期上升",
  down: "较上一周期下降",
  flat: "与上一周期持平",
  none: "上一周期无数据",
};

export function MetricCard({ card }: { card: MetricCardView }) {
  return (
    <article
      className={"metric-card metric-card--" + card.direction}
      data-testid="metric-card"
      data-metric-key={card.key}
      data-value={card.numeric === null ? "" : String(card.numeric)}
      data-display={card.display}
      data-previous={card.previousNumeric === null ? "" : String(card.previousNumeric)}
      data-delta={card.delta === null ? "" : String(card.delta)}
      data-delta-display={card.deltaDisplay}
      data-direction={card.direction}
    >
      <div className="metric-card__head">
        <h3 className="metric-card__label">{card.label}</h3>
        <TooltipHelp
          label={card.label}
          definition={card.definition}
          comparison={card.comparison}
          previous={formatMetricValue(card.previousNumeric, card.unit)}
          testId={"metric-help-" + card.key}
        />
      </div>
      <p className="metric-card__value" aria-label={card.label + " " + card.display}>
        {card.display}
      </p>
      <p
        className={"metric-card__delta metric-card__delta--" + card.direction}
        data-testid="metric-delta"
      >
        <span className="metric-card__arrow" aria-hidden="true">
          {ARROW[card.direction]}
        </span>
        <span className="metric-card__delta-value">{card.deltaDisplay}</span>
        <span className="metric-card__delta-label">
          {DIRECTION_TEXT[card.direction]} · 上一周期 {card.previousDisplay}
        </span>
      </p>
    </article>
  );
}
