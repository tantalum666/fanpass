import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";
import "./styles/command-strip.css";
import "./styles/event-card.css";
import "./styles/discover.css";
import "./styles/pulse.css";
import "./styles/pulse-drawer.css";
import "./styles/market.css";
import "./styles/event-detail.css";
import "./styles/checkout.css";
import "./styles/ticket-detail.css";
import "./styles/ticket-detail-ledger.css";
import "./styles/resale-listing.css";
import "./styles/resale-listing-summary.css";
import "./styles/view-frame.css";
import "./styles/route-frame.css";
import "./styles/feature-workspace.css";
import "./styles/feature-depth.css";
import "./styles/feature-lifecycle.css";
import "./styles/navigation.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
