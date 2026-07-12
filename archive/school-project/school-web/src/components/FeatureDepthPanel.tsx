import type { WebEvent } from "../types";
import type { FeatureDepthModel } from "../lib/featureDepthModel";

interface FeatureDepthPanelProps {
  model: FeatureDepthModel;
  onOpenEvent: (event: WebEvent) => void;
}

export function FeatureDepthPanel({ model, onOpenEvent }: FeatureDepthPanelProps) {
  return (
    <section
      className={`feature-depth-panel feature-depth-${model.kind}`}
      data-testid="feature-depth-panel"
      data-feature-depth-kind={model.kind}
      aria-label={`${model.title} route detail`}
    >
      <div className="feature-depth-header">
        <div>
          <span>{model.label}</span>
          <strong>{model.title}</strong>
          <p>{model.summary}</p>
        </div>
        <b>{model.value}</b>
      </div>
      <div className="feature-depth-body">
        <div className="feature-depth-rows">
          {model.rows.map((row, index) => (
            <button
              key={row.key}
              type="button"
              onClick={() => {
                if (row.event) {
                  onOpenEvent(row.event);
                }
              }}
              disabled={!row.event}
            >
              <span>{row.label}</span>
              <div>
                <strong>{row.title}</strong>
                <p>{row.meta}</p>
                <i style={{ width: `${row.progress}%` }} />
              </div>
              <b>{row.value}</b>
              <em>{String(index + 1).padStart(2, "0")}</em>
            </button>
          ))}
        </div>
        <div className="feature-depth-cards">
          {model.cards.map((card) => (
            <article key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
