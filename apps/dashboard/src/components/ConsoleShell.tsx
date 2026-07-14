import { useState, type ReactNode } from "react";
import { formatEventDate } from "../console/format";
import type { AlphaEvent, ConsolePageKey, ViewerRole } from "../console/types";
import { ConsoleIcon, type ConsoleIconName } from "./ConsoleIcon";
import { Badge } from "./ConsoleUi";

const navigation: {
  key: ConsolePageKey;
  label: string;
  description: string;
  icon: ConsoleIconName;
}[] = [
  {
    key: "overview",
    label: "Overview",
    description: "Event health",
    icon: "overview",
  },
  {
    key: "events",
    label: "Events",
    description: "Inventory setup",
    icon: "events",
  },
  {
    key: "sales",
    label: "Sales & market",
    description: "Orders and resale",
    icon: "sales",
  },
  { key: "entry", label: "Entry", description: "Gate activity", icon: "entry" },
  { key: "team", label: "Team", description: "Staff access", icon: "team" },
  {
    key: "risk",
    label: "Risk & audit",
    description: "Review trail",
    icon: "risk",
  },
];

export function ConsoleShell({
  page,
  events,
  selectedEvent,
  viewerRole,
  piiRedacted,
  refreshing,
  onPageChange,
  onEventChange,
  onRefresh,
  children,
}: {
  page: ConsolePageKey;
  events: AlphaEvent[];
  selectedEvent: AlphaEvent;
  viewerRole: ViewerRole;
  piiRedacted: boolean;
  refreshing: boolean;
  onPageChange: (page: ConsolePageKey) => void;
  onEventChange: (eventId: string) => void;
  onRefresh: () => Promise<void>;
  children: ReactNode;
}) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  function selectPage(nextPage: ConsolePageKey) {
    onPageChange(nextPage);
    setMobileNavigationOpen(false);
  }

  return (
    <div className="console-shell">
      <aside
        className={`sidebar ${mobileNavigationOpen ? "sidebar--open" : ""}`}
      >
        <div className="sidebar-brand">
          <span className="brand-mark">FP</span>
          <div>
            <strong>FanPass</strong>
            <span>Console</span>
          </div>
          <button
            aria-label="Close navigation"
            className="icon-button sidebar-close"
            onClick={() => setMobileNavigationOpen(false)}
            type="button"
          >
            <ConsoleIcon name="close" />
          </button>
        </div>
        <div className="workspace-identity">
          <span className="workspace-avatar">FP</span>
          <div>
            <strong>FanPass Events</strong>
            <span>
              {viewerRole === "ADMIN"
                ? "Admin workspace"
                : "Organizer workspace"}
            </span>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Console workspace">
          <p>Workspace</p>
          {navigation.map((item) => (
            <button
              aria-current={page === item.key ? "page" : undefined}
              className={`sidebar-link ${page === item.key ? "sidebar-link--active" : ""}`}
              key={item.key}
              onClick={() => selectPage(item.key)}
              type="button"
            >
              <ConsoleIcon name={item.icon} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Badge tone={piiRedacted ? "warning" : "success"}>
            {piiRedacted ? "PII redacted" : "Admin PII visible"}
          </Badge>
          <span>Data source: PostgreSQL</span>
        </div>
      </aside>

      {mobileNavigationOpen ? (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setMobileNavigationOpen(false)}
          type="button"
        />
      ) : null}

      <div className="console-main">
        <header className="context-bar">
          <button
            aria-label="Open navigation"
            className="icon-button mobile-menu"
            onClick={() => setMobileNavigationOpen(true)}
            type="button"
          >
            <ConsoleIcon name="menu" />
          </button>
          <div className="event-context">
            <label htmlFor="activeEvent">Active event</label>
            <select
              id="activeEvent"
              onChange={(event) => onEventChange(event.target.value)}
              value={selectedEvent.id}
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <span className="context-date">
              {formatEventDate(selectedEvent.startTime)} ·{" "}
              {selectedEvent.venue?.city ?? "Venue TBD"}
            </span>
          </div>
          <div className="context-actions">
            <Badge
              tone={selectedEvent.status === "ACTIVE" ? "success" : "neutral"}
            >
              {selectedEvent.status}
            </Badge>
            <button
              aria-label="Refresh operations"
              className="icon-button"
              disabled={refreshing}
              onClick={() => void onRefresh()}
              title="Refresh operations"
              type="button"
            >
              <ConsoleIcon name="refresh" />
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
