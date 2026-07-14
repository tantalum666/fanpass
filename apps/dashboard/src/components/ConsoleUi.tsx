import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span className={`status-badge status-badge--${tone}`}>{children}</span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`content-section ${className}`.trim()}>
      <header className="section-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function StatStrip({
  items,
}: {
  items: { label: string; value: ReactNode; meta?: ReactNode }[];
}) {
  return (
    <dl className="stat-strip">
      {items.map((item) => (
        <div className="stat-item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.meta ? <span>{item.meta}</span> : null}
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function TableFrame({ children }: { children: ReactNode }) {
  return <div className="table-frame">{children}</div>;
}

export function toneForStatus(status: string): BadgeTone {
  const normalized = status.toUpperCase();
  if (
    [
      "ACTIVE",
      "ACCEPTED",
      "APPROVED",
      "CAPTURED",
      "COMPLETED",
      "SETTLED",
      "LIVE",
    ].includes(normalized)
  ) {
    return "success";
  }
  if (
    ["FAILED", "REJECTED", "ERROR", "CANCELLED", "REVOKED"].includes(normalized)
  ) {
    return "danger";
  }
  if (["PENDING", "PROCESSING", "OPEN", "CONNECTING"].includes(normalized)) {
    return "info";
  }
  if (["INACTIVE", "EXPIRED", "DUPLICATE", "REFUNDED"].includes(normalized)) {
    return "warning";
  }
  return "neutral";
}
