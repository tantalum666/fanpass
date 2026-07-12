import {
  formatDate,
  formatMoney,
  formatShortDate,
  headlineFor,
  heroImageFor,
  lowestPrice,
  sublineFor,
} from "../lib/viewHelpers";
import type { WebEvent } from "../types";

interface EventCardProps {
  event: WebEvent;
  onOpenEvent: (event: WebEvent) => void;
}

export function EventCard({ event, onOpenEvent }: EventCardProps) {
  return (
    <button className="event-card" type="button" onClick={() => onOpenEvent(event)}>
      <div className="event-card-image">
        <img src={heroImageFor(event)} alt="" />
        <span className="event-date-tile">{formatShortDate(event.startsAt)}</span>
        <span className="event-status-chip">{event.status}</span>
      </div>
      <div className="event-card-body">
        <p>{formatDate(event.startsAt)} / {event.city}</p>
        <h3>{headlineFor(event)}</h3>
        <strong>{sublineFor(event)}</strong>
        <div className="event-card-footer">
          <span>{event.venue}</span>
          <b>{formatMoney(lowestPrice(event), event.ticketTypes[0]?.currency ?? "HKD")}</b>
        </div>
      </div>
    </button>
  );
}
