import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CircleDollarSign,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  formatDate,
  formatMoney,
  headlineFor,
  heroImageFor,
  sublineFor,
} from "../lib/viewHelpers";
import type { TicketType, UserTicket, WebEvent } from "../types";

interface ResaleListingViewProps {
  event: WebEvent;
  ticket: UserTicket;
  ticketType: TicketType;
  submitting: boolean;
  status: string;
  onBack: () => void;
  onSubmit: (price: number) => void;
  onOpenMarket: () => void;
}

export function ResaleListingView({
  event,
  ticket,
  ticketType,
  submitting,
  status,
  onBack,
  onSubmit,
  onOpenMarket,
}: ResaleListingViewProps) {
  const suggestedPrice = useMemo(
    () => Math.min(Math.round(Math.max(ticket.paid, ticketType.price) * 1.08), ticketType.resaleCap),
    [ticket.paid, ticketType.price, ticketType.resaleCap],
  );
  const [price, setPrice] = useState(String(suggestedPrice));
  const numericPrice = Number(price);
  const validPrice = Number.isFinite(numericPrice) && numericPrice > 0;
  const capExceeded = validPrice && numericPrice > ticketType.resaleCap;
  const underFace = validPrice && numericPrice < Math.round(ticketType.price * 0.55);
  const serviceFee = validPrice ? Math.round(numericPrice * 0.08) : 0;
  const payout = validPrice ? Math.max(0, Math.round(numericPrice - serviceFee)) : 0;
  const canSubmit = !submitting && validPrice && !capExceeded;
  const faceDelta = validPrice ? Math.round(numericPrice - ticketType.price) : 0;
  const capRoom = validPrice ? Math.max(0, ticketType.resaleCap - numericPrice) : ticketType.resaleCap;
  const capPercent = validPrice ? Math.round((numericPrice / ticketType.resaleCap) * 100) : 0;
  const priceBands = [
    {
      label: "Face value",
      value: ticketType.price,
      note: "Original issue anchor",
      active: validPrice && numericPrice <= ticketType.price,
    },
    {
      label: "Suggested",
      value: suggestedPrice,
      note: "Balanced market start",
      active: validPrice && numericPrice > ticketType.price && numericPrice <= suggestedPrice,
    },
    {
      label: "Organizer cap",
      value: ticketType.resaleCap,
      note: "Hard ceiling",
      active: validPrice && numericPrice > suggestedPrice,
    },
  ];
  const executionSteps = [
    {
      label: "Ownership check",
      value: "API-owned",
      detail: "Ticket holder and lifecycle state are checked before listing.",
    },
    {
      label: "Price guard",
      value: capExceeded ? "Blocked" : "Within cap",
      detail: "The organizer cap remains the hard ceiling for resale.",
    },
    {
      label: "Entry state",
      value: "Paused if open",
      detail: "Entry code stays unavailable while the sell order is live.",
    },
  ];

  return (
    <section className="product-view resale-listing-view">
      <button className="text-link ticket-back-link" type="button" onClick={onBack}>
        <ArrowLeft size={15} strokeWidth={2.2} />
        Back to ticket
      </button>

      <div className="resale-listing-grid">
        <section className="resale-editor-panel">
          <div className="resale-editor-hero">
            <img src={heroImageFor(event)} alt="" />
            <div>
              <span>{ticket.status}</span>
              <h1>List your ticket</h1>
              <p>{headlineFor(event)} / {sublineFor(event)}</p>
            </div>
          </div>

          <div className="listing-price-editor">
            <label htmlFor="listing-price">Listing price</label>
            <div>
              <span>{ticketType.currency}</span>
              <input
                id="listing-price"
                inputMode="numeric"
                pattern="[0-9]*"
                value={price}
                onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, ""))}
                aria-invalid={capExceeded || !validPrice}
              />
            </div>
            <p>
              Cap {formatMoney(ticketType.resaleCap, ticketType.currency)} / Face value{" "}
              {formatMoney(ticketType.price, ticketType.currency)}
            </p>
          </div>

          <div className="listing-range-track" aria-hidden="true">
            <span />
            <i style={{ left: `${Math.min(100, Math.max(0, (numericPrice / ticketType.resaleCap) * 100))}%` }} />
          </div>

          <div className="listing-price-context" data-testid="listing-price-context">
            {priceBands.map((band) => (
              <button
                key={band.label}
                type="button"
                className={band.active ? "active" : ""}
                onClick={() => setPrice(String(band.value))}
              >
                <span>{band.label}</span>
                <strong>{formatMoney(band.value, ticketType.currency)}</strong>
                <p>{band.note}</p>
              </button>
            ))}
          </div>

          <div className="listing-warnings" aria-live="polite">
            {capExceeded ? (
              <p className="danger">Price is above the organizer resale cap.</p>
            ) : underFace ? (
              <p>Price is far below face value. Check the number before listing.</p>
            ) : (
              <p>Listing stays within organizer rules and can be cancelled while still open.</p>
            )}
          </div>

          <div className="listing-action-row">
            <button type="button" disabled={!canSubmit} onClick={() => onSubmit(Math.round(numericPrice))}>
              {submitting ? "Creating listing..." : "List ticket"}
            </button>
            <button type="button" onClick={onOpenMarket}>View market context</button>
          </div>

          <div className="listing-status-line">{status}</div>
        </section>

        <aside className="resale-summary-panel">
          <div className="panel-heading">
            <span>Listing summary</span>
            <strong>{validPrice && !capExceeded ? "Ready" : "Check price"}</strong>
          </div>
          <div className="resale-ticket-strip">
            <img src={heroImageFor(event)} alt="" />
            <div>
              <span>{formatDate(event.startsAt)}</span>
              <strong>{headlineFor(event)}</strong>
              <p>{ticketType.section} / {safeFragment(ticket.id)}</p>
            </div>
          </div>
          <dl className="resale-payout-table">
            <div>
              <dt>List price</dt>
              <dd>{validPrice ? formatMoney(numericPrice, ticketType.currency) : "-"}</dd>
            </div>
            <div>
              <dt>Service fee estimate</dt>
              <dd>{formatMoney(serviceFee, ticketType.currency)}</dd>
            </div>
            <div>
              <dt>Estimated payout</dt>
              <dd>{formatMoney(payout, ticketType.currency)}</dd>
            </div>
            <div>
              <dt>Above face</dt>
              <dd>{validPrice ? formatMoney(faceDelta, ticketType.currency) : "-"}</dd>
            </div>
            <div>
              <dt>Cap room</dt>
              <dd>{validPrice ? `${capPercent}% / ${formatMoney(capRoom, ticketType.currency)}` : "-"}</dd>
            </div>
          </dl>
          <section className="resale-execution-path" aria-label="Listing execution path">
            <div className="panel-heading">
              <span>Execution path</span>
              <strong>{capExceeded ? "Blocked" : "Ready"}</strong>
            </div>
            {executionSteps.map((step) => (
              <article key={step.label}>
                <span>{step.label}</span>
                <strong>{step.value}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </section>
          <div className="resale-rule-stack">
            <RuleRow icon={ShieldCheck} label="Owner check" value="Required by API" />
            <RuleRow icon={LockKeyhole} label="Organizer cap" value={formatMoney(ticketType.resaleCap, ticketType.currency)} />
            <RuleRow icon={CircleDollarSign} label="Face value" value={formatMoney(ticketType.price, ticketType.currency)} />
            <RuleRow icon={SlidersHorizontal} label="State after listing" value="Entry paused while open" />
            <RuleRow icon={BarChart3} label="Market posture" value={underFace ? "Low ask" : capExceeded ? "Above cap" : "Under cap"} />
            <RuleRow icon={CalendarClock} label="Seller control" value="Cancel while open" />
          </div>
        </aside>
      </div>
    </section>
  );
}

function RuleRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div>
      <Icon size={15} strokeWidth={2.2} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function safeFragment(value: string) {
  const compact = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `FP-${compact.slice(-6).padStart(6, "0")}`;
}
