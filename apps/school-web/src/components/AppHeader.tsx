import { useEffect, useRef, type ComponentType } from "react";
import {
  Bell,
  CalendarDays,
  ChartCandlestick,
  ClipboardList,
  Compass,
  Layers3,
  MapPin,
  Mic2,
  Sparkles,
  Ticket,
  WalletCards,
} from "lucide-react";
import type { ApiStatus, AppView } from "../types";

const NAV_GROUPS = [
  [
    { icon: Compass, label: "Home", testId: "nav-discover", view: "discover" as const },
    { icon: Sparkles, label: "For You", testId: "nav-for-you", view: "forYou" as const },
    { icon: CalendarDays, label: "Events", testId: "nav-events", view: "events" as const },
    { icon: MapPin, label: "Venues", testId: "nav-venues", view: "venues" as const },
    { icon: Mic2, label: "Artists", testId: "nav-artists", view: "artists" as const },
    { icon: Layers3, label: "Collections", testId: "nav-collections", view: "collections" as const },
  ],
  [
    { icon: Ticket, label: "My Tickets", testId: "nav-my-tickets", view: "tickets" as const },
    { icon: WalletCards, label: "Wallet", testId: "nav-wallet", view: "wallet" as const },
    { icon: ClipboardList, label: "Orders", testId: "nav-orders", view: "orders" as const },
    { icon: ChartCandlestick, label: "Market", testId: "nav-listings", view: "market" as const },
  ],
  [
    { icon: Layers3, label: "Analytics", testId: "nav-analytics", view: "analytics" as const },
    { icon: Bell, label: "Alerts", testId: "nav-alerts", view: "alerts" as const },
    { icon: Layers3, label: "Settings", testId: "nav-settings", view: "settings" as const },
  ],
];

interface AppHeaderProps {
  activeView: AppView;
  apiStatus: ApiStatus;
  onNavigate: (view: AppView) => void;
}

export function AppHeader({
  activeView,
  apiStatus,
  onNavigate,
}: AppHeaderProps) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const activeButton = navRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]');
    activeButton?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "start" });
  }, [activeView]);

  return (
    <header className="app-header">
      <div className="brand-zone">
        <button className="brand-button" type="button" onClick={() => onNavigate("discover")}>
          <img src="/brand/fanpass-horizontal-lockup-v4.svg" alt="FanPass" />
        </button>
        <div className="api-pill" title={apiStatus.detail}>
          <span>{apiStatus.label}</span>
        </div>
      </div>
      <nav className="top-nav" aria-label="Primary" ref={navRef}>
        {NAV_GROUPS.map((group, groupIndex) => (
          <div className="nav-group" key={`group-${groupIndex}`}>
            {group.map((item) => (
              <NavButton
                key={item.label}
                icon={item.icon}
                label={item.label}
                testId={item.testId}
                view={item.view}
                activeView={activeView}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>
      <div className="profile-strip">
        <span>AC</span>
        <div>
          <strong>Alex Chen</strong>
          <p>Fan since 2022</p>
        </div>
      </div>
    </header>
  );
}

function NavButton({
  icon: Icon,
  label,
  testId,
  view,
  activeView,
  onNavigate,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  testId: string;
  view: AppView;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}) {
  const active = activeView === view;

  return (
    <button
      className={active ? "nav-button active" : "nav-button"}
      type="button"
      data-testid={testId}
      data-view={view}
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      onClick={() => onNavigate(view)}
    >
      <span className="nav-active-marker" aria-hidden="true" />
      <Icon size={15} strokeWidth={2} />
      <span className="nav-label">{label}</span>
    </button>
  );
}
