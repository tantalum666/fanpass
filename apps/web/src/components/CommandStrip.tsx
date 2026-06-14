import { Bell, Heart, ShoppingBag } from "lucide-react";
import type { EventCategory } from "../types";

interface CommandStripProps {
  query: string;
  city: string;
  category: EventCategory | "All";
  onQueryChange: (query: string) => void;
}

export function CommandStrip({
  query,
  city,
  category,
  onQueryChange,
}: CommandStripProps) {
  return (
    <section className="command-strip" aria-label="Search and filters">
      <div className="search-box">
        <span aria-hidden="true">Search</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search artists, events, venues, cities"
        />
      </div>
      <div className="topbar-controls">
        <button type="button">USD</button>
        <button type="button">{city === "All" ? "New York" : city}</button>
        <button type="button">{category === "All" ? "All shows" : category}</button>
        <div className="utility-actions" aria-label="Quick actions">
          <button type="button" aria-label="Saved events"><Heart size={16} strokeWidth={2} /></button>
          <button type="button" aria-label="Cart"><ShoppingBag size={16} strokeWidth={2} /></button>
          <button type="button" aria-label="Alerts"><Bell size={16} strokeWidth={2} /></button>
        </div>
      </div>
    </section>
  );
}
