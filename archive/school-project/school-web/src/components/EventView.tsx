import {
  ArrowRight,
  CalendarClock,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  TrendingUp,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Metric } from "./Metric";
import {
  formatDate,
  formatMoney,
  formatOptionalMoney,
  headlineFor,
  heroImageFor,
  lowestListing,
  lowestPrice,
  seatOptionsFor,
  sublineFor,
} from "../lib/viewHelpers";
import type { MarketListing, TicketType, WebEvent } from "../types";

interface EventViewProps {
  event: WebEvent;
  listings: MarketListing[];
  selectedTicketTypeId: string;
  onSelectTicketType: (ticketTypeId: string) => void;
  onStartCheckout: (ticketType: TicketType) => void;
  onOpenMarket: () => void;
}

export function EventView({
  event,
  listings,
  selectedTicketTypeId,
  onSelectTicketType,
  onStartCheckout,
  onOpenMarket,
}: EventViewProps) {
  const selectedTicketType =
    event.ticketTypes.find((ticketType) => ticketType.id === selectedTicketTypeId) ??
    event.ticketTypes[0];
  const currency = selectedTicketType?.currency ?? event.ticketTypes[0]?.currency ?? "HKD";
  const resaleFloor = lowestListing(listings);
  const priceContext = seatOptionsFor(event).slice(0, 5);
  const selectedRemaining = selectedTicketType ? Math.max(selectedTicketType.remaining, 0) : 0;
  const totalPrimarySupply = event.ticketTypes.reduce(
    (sum, ticketType) => sum + Math.max(ticketType.remaining, 0),
    0,
  );
  const listedSupply = listings.reduce((sum, listing) => sum + listing.quantity, 0);
  const capRoom = selectedTicketType ? Math.max(0, selectedTicketType.resaleCap - selectedTicketType.price) : 0;
  const priceValues = [
    ...priceContext.map((option) => option.price),
    ...(selectedTicketType ? [selectedTicketType.price, selectedTicketType.resaleCap] : []),
  ];
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);
  const priceSpread = Math.max(maxPrice - minPrice, 1);
  const eventControlRows = [
    {
      label: "Verified supply",
      value: `${totalPrimarySupply} seats`,
      detail: `${event.ticketTypes.length} live bands`,
    },
    {
      label: "Market floor",
      value: formatOptionalMoney(resaleFloor, currency),
      detail: listedSupply > 0 ? `${listedSupply} resale tickets` : "Primary only",
    },
    {
      label: "Cap room",
      value: selectedTicketType ? formatMoney(capRoom, currency) : "-",
      detail: "Organizer guard visible",
    },
    {
      label: "Transfer window",
      value: "Open",
      detail: "Rules travel with ticket",
    },
  ];
  const decisionRows = [
    {
      label: "Primary access",
      state: selectedRemaining > 0 ? "Available" : "Waitlist",
      detail: selectedTicketType
        ? `${selectedTicketType.name} has ${selectedRemaining} seats remaining.`
        : "No live ticket band selected.",
    },
    {
      label: "Resale guard",
      state: selectedTicketType && resaleFloor && resaleFloor <= selectedTicketType.resaleCap ? "Within cap" : "Observed",
      detail: selectedTicketType
        ? `${formatMoney(selectedTicketType.resaleCap, currency)} organizer cap remains visible before checkout.`
        : "Organizer cap is unavailable for this event.",
    },
    {
      label: "Checkout boundary",
      state: "Server-owned",
      detail: "The event page shows readable eligibility only; payment, holder, and provider evidence stay behind the API.",
    },
  ];

  return (
    <section className="product-view event-view event-detail-concept">
      <div className="event-detail-hero" style={{ "--event-accent": event.accent } as CSSProperties}>
        <img className="event-detail-art" src={heroImageFor(event)} alt="" />
        <div className="event-detail-shade" />
        <div className="event-detail-copy">
          <span className="status-chip">{event.status}</span>
          <p>{formatDate(event.startsAt)} / {event.city}</p>
          <h1>{headlineFor(event)}</h1>
          <strong>{sublineFor(event)}</strong>
          <div className="event-detail-actions">
            <button type="button" onClick={() => selectedTicketType && onStartCheckout(selectedTicketType)}>
              Get tickets
            </button>
            <button type="button" onClick={onOpenMarket}>
              Open market
            </button>
          </div>
        </div>
        <aside className="event-detail-ticket-stack" aria-label="Available ticket tiers">
          <div className="panel-heading">
            <span>Ticket selection</span>
            <strong>{event.ticketTypes.length} live bands</strong>
          </div>
          <div className="primary-ticket-list">
            {event.ticketTypes.map((ticketType) => (
              <button
                key={ticketType.id}
                className={ticketType.id === selectedTicketType?.id ? "event-tier-row active" : "event-tier-row"}
                type="button"
                onClick={() => onSelectTicketType(ticketType.id)}
              >
                <span>
                  <strong>{ticketType.name}</strong>
                  <small>{ticketType.section}</small>
                </span>
                <b>{formatMoney(ticketType.price, ticketType.currency)}</b>
              </button>
            ))}
          </div>
          {selectedTicketType && (
            <>
              <div className="event-tier-meta-grid">
                <div>
                  <span>Face value</span>
                  <strong>{formatMoney(selectedTicketType.price, selectedTicketType.currency)}</strong>
                </div>
                <div>
                  <span>Organizer cap</span>
                  <strong>{formatMoney(selectedTicketType.resaleCap, selectedTicketType.currency)}</strong>
                </div>
                <div>
                  <span>Remaining</span>
                  <strong>{selectedRemaining}</strong>
                </div>
              </div>
              <div className="price-context-list" aria-label="Price context">
                <div className="context-heading">
                  <span>Price context</span>
                  <strong>Verified resale bands</strong>
                </div>
                {priceContext.map((option) => (
                  <div
                    key={option.name}
                    className={option.featured ? "price-context-row featured" : "price-context-row"}
                  >
                    <span>
                      <strong>{option.name}</strong>
                      <small>{option.detail}</small>
                    </span>
                    <b>{formatMoney(option.price, currency)}</b>
                  </div>
                ))}
              </div>
              <div className="event-detail-summary">
                <div>
                  <p>Checkout preview</p>
                  <strong>{selectedTicketType.name}</strong>
                  <small>{selectedTicketType.perks.slice(0, 2).join(" / ")}</small>
                </div>
                <button type="button" onClick={() => onStartCheckout(selectedTicketType)}>
                  Continue <ArrowRight size={15} strokeWidth={2.2} />
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      <div className="event-control-strip" data-testid="event-control-strip">
        {eventControlRows.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="event-detail-grid">
        <section className="event-detail-story">
          <div className="section-title compact">
            <div>
              <span>FanPass model</span>
              <h2>One verified place for primary access and fair resale.</h2>
            </div>
          </div>
          <p>{event.summary}</p>
          <div className="event-detail-metrics">
            <Metric label="Date" value={formatDate(event.startsAt)} />
            <Metric label="Demand" value={`${event.demand}%`} />
            <Metric label="Venue" value={event.venue} />
          </div>
        </section>

        <aside className="event-detail-market">
          <div className="panel-heading">
            <span>Market pulse</span>
            <strong>{formatOptionalMoney(resaleFloor, currency)}</strong>
          </div>
          <div className="market-meter">
            <span style={{ width: `${event.demand}%` }} />
          </div>
          <dl>
            <div>
              <dt>Face value from</dt>
              <dd>{formatMoney(lowestPrice(event), currency)}</dd>
            </div>
            <div>
              <dt>Resale cap</dt>
              <dd>{selectedTicketType ? formatMoney(selectedTicketType.resaleCap, currency) : "-"}</dd>
            </div>
            <div>
              <dt>Active listings</dt>
              <dd>{listings.length}</dd>
            </div>
          </dl>
          <button className="secondary-action" type="button" onClick={onOpenMarket}>
            View orderbook
          </button>
        </aside>

        <section className="event-price-radar" aria-label="Event price intelligence">
          <div className="panel-heading">
            <span>Price intelligence</span>
            <strong>{selectedTicketType ? selectedTicketType.name : "Live bands"}</strong>
          </div>
          <div className="event-range-axis">
            <span>{formatMoney(minPrice, currency)}</span>
            <span>{formatMoney(maxPrice, currency)}</span>
          </div>
          <div className="event-range-list">
            {priceContext.map((option) => {
              const width = Math.max(8, Math.round(((option.price - minPrice) / priceSpread) * 100));
              return (
                <article key={option.name} className={option.featured ? "featured" : ""}>
                  <div>
                    <span>{option.name}</span>
                    <strong>{formatMoney(option.price, currency)}</strong>
                  </div>
                  <div className="event-range-bar" style={{ "--range-width": `${width}%` } as CSSProperties}>
                    <i />
                  </div>
                </article>
              );
            })}
          </div>
          <div className="event-cap-line">
            <span>Organizer cap</span>
            <strong>{selectedTicketType ? formatMoney(selectedTicketType.resaleCap, currency) : "-"}</strong>
          </div>
        </section>

        <section className="event-decision-ledger" aria-label="Event access ledger">
          <div className="panel-heading">
            <span>Access ledger</span>
            <strong>Safe readout</strong>
          </div>
          {decisionRows.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.state}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="event-access-panel">
          <div className="panel-heading">
            <span>Fan access</span>
            <strong>Ready</strong>
          </div>
          <div className="access-score-card">
            <Sparkles size={18} strokeWidth={2.2} />
            <div>
              <span>Eligibility result</span>
              <strong>Verified fan checkout path</strong>
              <p>FanPass only shows the readable access result here; private scoring inputs stay outside the web surface.</p>
            </div>
          </div>
          <div className="access-check-row">
            {[
              { icon: ShieldCheck, label: "Holder boundary", value: "Checked" },
              { icon: TrendingUp, label: "Price cap", value: "Visible" },
              { icon: CalendarClock, label: "Transfer window", value: "Open" },
            ].map((item) => (
              <div key={item.label}>
                <item.icon size={16} strokeWidth={2.2} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="event-lifecycle-panel">
          <div className="panel-heading">
            <span>Issue flow</span>
            <strong>Safe preview</strong>
          </div>
          {[
            { icon: TicketCheck, label: "Inventory reserved", text: "Checkout reserves a live ticket band before payment authorization." },
            { icon: LockKeyhole, label: "Payment boundary", text: "Demo checkout avoids production credentials and never displays raw provider data." },
            { icon: Clock3, label: "Pass issued", text: "A readable ticket state is created after confirmation; proof history remains redacted." },
          ].map((item) => (
            <article key={item.label}>
              <item.icon size={17} strokeWidth={2.2} />
              <div>
                <strong>{item.label}</strong>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="event-detail-principles">
          {event.highlights.map((item, index) => (
            <article key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </article>
          ))}
        </section>

        <section className="event-detail-policy">
          {[
            { icon: ShieldCheck, label: "Verified issue", text: event.policy[0] ?? "Tickets stay attached to the latest verified holder." },
            { icon: TrendingUp, label: "Transparent market", text: event.policy[1] ?? "Primary and resale prices remain visible before checkout." },
            { icon: ShieldCheck, label: "Fair control", text: event.policy[2] ?? "Organizer rules travel with the ticket lifecycle." },
          ].map((item) => (
            <article key={item.label}>
              <item.icon size={18} strokeWidth={2.2} />
              <div>
                <strong>{item.label}</strong>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
