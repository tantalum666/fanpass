import { FeatureDepthPanel } from "./FeatureDepthPanel";
import { Metric } from "./Metric";
import {
  demoOrders,
  formatMoney,
  formatShortDate,
  headlineFor,
  heroImageFor,
  lowestPrice,
  sublineFor,
  ticketsForDrawer,
} from "../lib/viewHelpers";
import { buildFeatureDepthModel, type FeatureKind } from "../lib/featureDepthModel";
import {
  buildFeatureCommandCards,
  buildFeatureEvidenceRows,
  buildFeatureRows,
  featureConfig,
} from "../lib/featureWorkspaceModel";
import { orderPresentationFor, orderToneClass } from "../lib/orderPresentation";
import { ticketLifecycleCopy } from "../lib/ticketLifecycle";
import type { AppView, MarketListing, UserOrder, UserTicket, WebEvent } from "../types";

interface FeatureWorkspaceProps {
  kind: FeatureKind;
  events: WebEvent[];
  tickets: UserTicket[];
  orders: UserOrder[];
  listings: MarketListing[];
  onOpenEvent: (event: WebEvent) => void;
  onNavigate: (view: AppView) => void;
}

export function FeatureWorkspace({
  kind,
  events,
  tickets,
  orders,
  listings,
  onOpenEvent,
  onNavigate,
}: FeatureWorkspaceProps) {
  const lead = events[0];
  const config = featureConfig(kind);
  const FeatureIcon = config.icon;
  const visibleOrders = orders.length ? orders : demoOrders(events);
  const rows = buildFeatureRows(kind, events, tickets, listings);
  const spotlight = lead ? [lead, ...events.filter((event) => event.id !== lead.id)].slice(0, 3) : [];
  const drawerTickets = lead ? ticketsForDrawer(lead, tickets) : [];
  const commandCards = buildFeatureCommandCards(kind, events, tickets, visibleOrders, listings, rows);
  const evidenceRows = buildFeatureEvidenceRows(kind, lead, visibleOrders, tickets, listings, rows);
  const depthModel = buildFeatureDepthModel(kind, events, tickets, visibleOrders, listings, rows);

  return (
    <section className={`product-view feature-workspace feature-${kind}`}>
      <div className="feature-masthead">
        <div className="feature-masthead-copy">
          <div className="feature-title-row">
            <span className="feature-icon-badge" aria-hidden="true">
              <FeatureIcon size={16} strokeWidth={2.15} />
            </span>
            <span>{config.eyebrow}</span>
          </div>
          <h1>{config.title}</h1>
          <p>{config.copy}</p>
          <div className="feature-actions">
            <button type="button" onClick={() => onNavigate(config.primaryView)}>
              {config.primaryAction}
            </button>
            <button type="button" onClick={() => onNavigate(config.secondaryView)}>
              {config.secondaryAction}
            </button>
          </div>
        </div>
        <div className="feature-metric-strip">
          <Metric label="Events" value={`${events.length}`} />
          <Metric label="Tickets" value={`${tickets.length}`} />
          <Metric label="Listings" value={`${listings.length}`} />
          <Metric label="Orders" value={`${visibleOrders.length}`} />
        </div>
      </div>

      <section className="feature-command-strip" data-testid="feature-command-strip" aria-label={`${config.title} command strip`}>
        {commandCards.map((card) => (
          <article key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      {depthModel && <FeatureDepthPanel model={depthModel} onOpenEvent={onOpenEvent} />}

      <div className="feature-canvas-grid">
        <section className="feature-spotlight-panel">
          <div className="panel-heading">
            <span>{config.spotlightLabel}</span>
            <strong>{config.actionValue}</strong>
          </div>
          {spotlight.map((event) => (
            <button key={event.id} type="button" onClick={() => onOpenEvent(event)}>
              <img src={heroImageFor(event)} alt="" />
              <div>
                <span>{formatShortDate(event.startsAt)} / {event.city}</span>
                <strong>{headlineFor(event)}</strong>
                <p>{sublineFor(event)}</p>
              </div>
              <b>{formatMoney(lowestPrice(event), event.ticketTypes[0]?.currency ?? "HKD")}</b>
            </button>
          ))}
        </section>

        <section className="feature-list-panel">
          <div className="panel-heading">
            <span>{config.listLabel}</span>
            <strong>{rows.length} rows</strong>
          </div>
          <div className="feature-rows">
            {rows.map((row, index) => (
              <button
                key={row.key}
                type="button"
                onClick={() => {
                  const event = events[index % Math.max(events.length, 1)];
                  if (event) {
                    onOpenEvent(event);
                  }
                }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{row.title}</strong>
                  <p>{row.meta}</p>
                </div>
                <b>{row.value}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="feature-action-panel">
          <div className="panel-heading">
            <span>{config.actionLabel}</span>
            <strong>{config.signal}</strong>
          </div>
          {kind === "orders" ? (
            <div className="feature-mini-table">
              {visibleOrders.map((order) => {
                const event = events.find((item) => item.id === order.eventId) ?? lead;
                return (
                  <div key={order.id}>
                    <span>{order.status}</span>
                    <strong>{event ? headlineFor(event) : "FanPass"}</strong>
                    <p>{order.side} / {formatMoney(order.total, event?.ticketTypes[0]?.currency ?? "HKD")}</p>
                  </div>
                );
              })}
            </div>
          ) : kind === "wallet" ? (
            <div className="feature-pass-stack">
              {drawerTickets.map((ticket) => (
                <article key={ticket.id}>
                  {lead && <img src={heroImageFor(lead)} alt="" />}
                  <div>
                    <span>{ticket.status}</span>
                    <strong>{ticket.code}</strong>
                    <p>{ticket.holder}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="feature-signal-card">
              {lead && <img src={heroImageFor(lead)} alt="" />}
              <div>
                <span>{config.signal}</span>
                <strong>{lead ? headlineFor(lead) : "FanPass"}</strong>
                <p>{lead ? sublineFor(lead) : "No event loaded yet."}</p>
              </div>
            </div>
          )}
          <div className="feature-checks">
            {config.checks.map((check) => (
              <div key={check}>
                <span />
                {check}
              </div>
            ))}
          </div>
        </section>

        <section className="feature-system-panel">
          <div className="panel-heading">
            <span>{config.systemLabel}</span>
            <strong>{kind === "settings" ? "Configured" : "Ready"}</strong>
          </div>
          <div className="feature-system-layout">
            <div className="feature-system-flow">
              {config.flow.map((item, index) => (
                <div key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
            <div className="feature-evidence-rail" data-testid="feature-evidence-rail">
              {evidenceRows.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      {kind === "settings" && <LifecycleCoveragePanel />}
    </section>
  );
}

function LifecycleCoveragePanel() {
  const ticketStates: UserTicket["status"][] = [
    "Transfer Pending",
    "Redeemed",
    "Cancelled",
    "Refunded",
    "Expired",
  ];
  const orderStates: UserOrder["status"][] = [
    "Authorized",
    "Failed",
    "Expired",
    "Refunded",
  ];

  return (
    <section className="feature-lifecycle-panel" data-testid="state-fixture-panel">
      <div className="panel-heading">
        <span>Lifecycle coverage</span>
        <strong>Rendered fixtures</strong>
      </div>
      <p>
        Safe state fixtures for review and browser QA. They use the same typed presentation helpers as the live wallet
        and order surfaces without exposing raw credential, owner, wallet, payment, or provider identifiers.
      </p>
      <div className="feature-lifecycle-grid">
        <div>
          <div className="panel-heading">
            <span>Ticket states</span>
            <strong>{ticketStates.length} blocked/pending</strong>
          </div>
          {ticketStates.map((status) => {
            const lifecycle = ticketLifecycleCopy(status);
            return (
              <article
                key={status}
                className={`feature-state-row state-tone-${lifecycle.tone}`}
                data-ticket-fixture={lifecycle.statusClass}
              >
                <span>{lifecycle.entryProofState}</span>
                <strong>{status}</strong>
                <p>{lifecycle.lifecycleHistoryText}</p>
                <b>{lifecycle.drawerDetail}</b>
              </article>
            );
          })}
        </div>
        <div>
          <div className="panel-heading">
            <span>Order states</span>
            <strong>{orderStates.length} payment outcomes</strong>
          </div>
          {orderStates.map((status) => {
            const presentation = orderPresentationFor(fixtureOrderFor(status));
            return (
              <article
                key={status}
                className={`feature-state-row ${orderToneClass(presentation.tone)}`}
                data-order-fixture={status.toLowerCase()}
              >
                <span>{presentation.safeOrderRef}</span>
                <strong>{presentation.title}</strong>
                <p>{presentation.summary}</p>
                <b>{presentation.paymentState} / {presentation.settlementState}</b>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function fixtureOrderFor(status: UserOrder["status"]): UserOrder {
  const fixtureRefs: Record<UserOrder["status"], string> = {
    Reserved: "fixture-order-resv01",
    Authorized: "fixture-order-auth01",
    Confirmed: "fixture-order-sett01",
    Listed: "fixture-order-list01",
    Cancelled: "fixture-order-cncl01",
    Failed: "fixture-order-fail01",
    Expired: "fixture-order-expr01",
    Refunded: "fixture-order-rfnd01",
  };

  return {
    id: fixtureRefs[status],
    eventId: "fixture-event",
    ticketTypeId: "fixture-ticket-type",
    ticketId: `fixture-ticket-${status.toLowerCase()}`,
    side: status === "Authorized" ? "Buy" : "Sell",
    status,
    total: 1288,
    createdAt: "2026-06-08T00:00:00.000Z",
  };
}
