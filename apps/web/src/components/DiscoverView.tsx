import { EventCard } from "./EventCard";
import {
  buildShowcaseEvents,
  formatDate,
  formatMoney,
  headlineFor,
  heroImageFor,
  lowestPrice,
  seatOptionsFor,
  sublineFor,
} from "../lib/viewHelpers";
import type { MarketListing, UserTicket, WebEvent } from "../types";

interface DiscoverViewProps {
  events: WebEvent[];
  allEvents: WebEvent[];
  listings: MarketListing[];
  tickets: UserTicket[];
  onOpenEvent: (event: WebEvent) => void;
  onOpenMarket: (event: WebEvent) => void;
}

export function DiscoverView({
  events,
  allEvents,
  onOpenEvent,
}: DiscoverViewProps) {
  const lead = events[0] ?? allEvents[0];
  const showcase = buildShowcaseEvents(lead, allEvents);
  const secondaryShowcase = showcase.length > 1 ? [...showcase].slice(1).concat(showcase[0]).slice(0, 4) : showcase;

  return (
    <section className="product-view discover-view">
      {lead && (
        <div className="premium-marketplace">
          <div className="editorial-hero">
            <img src={heroImageFor(lead)} alt="" />
            <div className="editorial-copy">
              <span>{formatDate(lead.startsAt)}</span>
              <h1>{headlineFor(lead)}</h1>
              <p>{sublineFor(lead)}</p>
              <div className="rating-line">
                <strong>4.9</strong>
                <span>12.4K fans tracking</span>
              </div>
              <div className="hero-actions">
                <button type="button" onClick={() => onOpenEvent(lead)}>Get Tickets</button>
                <button type="button" onClick={() => onOpenEvent(lead)}>Save</button>
              </div>
            </div>
          </div>
          <aside className="editorial-checkout">
            <div className="panel-heading">
              <span>{headlineFor(lead)}</span>
              <strong>{lead.venue}</strong>
            </div>
            <div className="ticket-filter-row">
              <button type="button">2 tickets</button>
              <button type="button">All prices</button>
            </div>
            <div className="seat-list">
              {seatOptionsFor(lead).map((seat) => (
                <button key={seat.name} className={seat.featured ? "active" : ""} type="button">
                  <span>{seat.name}<small>{seat.detail}</small></span>
                  <strong>{formatMoney(seat.price, lead.ticketTypes[0]?.currency ?? "HKD")}</strong>
                </button>
              ))}
            </div>
            <div className="concept-summary">
              <span>Checkout summary</span>
              <div><p>2 tickets</p><strong>{formatMoney(lowestPrice(lead) * 2, lead.ticketTypes[0]?.currency ?? "HKD")}</strong></div>
              <div><p>Service fee</p><strong>{formatMoney(Math.round(lowestPrice(lead) * 0.1), lead.ticketTypes[0]?.currency ?? "HKD")}</strong></div>
              <div><p>Order total</p><strong>{formatMoney(Math.round(lowestPrice(lead) * 2.1), lead.ticketTypes[0]?.currency ?? "HKD")}</strong></div>
              <button type="button" onClick={() => onOpenEvent(lead)}>Continue to checkout</button>
            </div>
          </aside>
        </div>
      )}

      <div className="section-title">
        <div>
          <span>Recommended for you</span>
          <h2>Recommended For You</h2>
        </div>
        <p>View all</p>
      </div>

      <div className="event-grid">
        {showcase.map((event) => (
          <EventCard key={event.id} event={event} onOpenEvent={onOpenEvent} />
        ))}
      </div>

      <div className="discover-chip-row" aria-label="Discovery filters">
        {["All", "Nearby", "This week", "Under HK$1,000", "Pop", "Rock", "Festival"].map((chip) => (
          <button key={chip} type="button">{chip}</button>
        ))}
      </div>

      <div className="section-title discover-secondary-title">
        <div>
          <span>Because you follow verified arena drops</span>
          <h2>Because You Listen To BLACKPINK, TWICE, aespa</h2>
        </div>
        <p>View all</p>
      </div>

      <div className="event-grid discover-secondary-grid">
        {secondaryShowcase.map((event) => (
          <EventCard key={`secondary-${event.id}`} event={event} onOpenEvent={onOpenEvent} />
        ))}
      </div>
    </section>
  );
}
