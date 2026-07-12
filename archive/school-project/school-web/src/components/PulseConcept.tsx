import { CheckCircle2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import {
  demoOrders,
  formatDate,
  formatMoney,
  formatShortDate,
  headlineFor,
  heroImageFor,
  lowestPrice,
  sublineFor,
  ticketsForDrawer,
} from "../lib/viewHelpers";
import {
  isTicketEntryEligible,
  isTicketListable,
  ticketLifecycleCopy,
} from "../lib/ticketLifecycle";
import { orderPresentationFor, orderToneClass } from "../lib/orderPresentation";
import type { AppView, UserOrder, UserTicket, WebEvent } from "../types";

interface PulseConceptProps {
  surface: Extract<AppView, "tickets" | "wallet" | "orders">;
  event: WebEvent;
  showcase: WebEvent[];
  tickets: UserTicket[];
  orders: UserOrder[];
  onOpenEvent: (event: WebEvent) => void;
  onOpenTicket: (ticket: UserTicket) => void;
  onListTicket: (ticket: UserTicket) => void;
  onNavigate: (view: AppView) => void;
}

export function PulseConcept({
  surface,
  event,
  showcase,
  tickets,
  orders,
  onOpenEvent,
  onOpenTicket,
  onListTicket,
  onNavigate,
}: PulseConceptProps) {
  const drawerTickets = ticketsForDrawer(event, tickets);
  const activeTicket =
    drawerTickets.find(isTicketEntryEligible) ??
    drawerTickets[0];
  const selectedTicketType =
    event.ticketTypes.find((ticketType) => ticketType.id === activeTicket?.ticketTypeId) ??
    event.ticketTypes[0];
  const latestOrder = orders[0] ?? demoOrders([event])[0];
  const latestOrderEvent = showcase.find((item) => item.id === latestOrder?.eventId) ?? event;
  const latestOrderTicket =
    latestOrderEvent.ticketTypes.find((ticketType) => ticketType.id === latestOrder?.ticketTypeId) ??
    latestOrderEvent.ticketTypes[0];
  const orderTotal = latestOrder?.total ?? latestOrderTicket?.price ?? lowestPrice(event);
  const orderFee = Math.round(orderTotal * 0.116);
  const currency = latestOrderTicket?.currency ?? selectedTicketType?.currency ?? "HKD";
  const latestOrderPresentation = orderPresentationFor(latestOrder);
  const copy = pulseCopyFor(surface);
  const visibleOrders = (orders.length ? orders : demoOrders([event])).slice(0, 3);
  const walletStats = [
    { label: "Ready", value: String(tickets.filter(isTicketEntryEligible).length) },
    { label: "Listed", value: String(tickets.filter((ticket) => ticket.status === "Listed").length) },
    { label: "Orders", value: String(Math.max(orders.length, 1)) },
  ];

  return (
    <section className={`product-view pulse-concept pulse-${surface}`}>
      <div className="pulse-main">
        <div className="pulse-command-deck">
          <div className="section-title compact pulse-workspace-title">
            <div>
              <span>{copy.workspaceKicker}</span>
              <h2>{copy.workspaceTitle}</h2>
            </div>
            <p>{copy.workspaceMeta}</p>
          </div>
          <div className="pulse-command-grid">
            <section className="pulse-command-hero">
              <img src={heroImageFor(event)} alt="" />
              <div>
                <span>{copy.heroEyebrow}</span>
                <h3>{headlineFor(event)}</h3>
                <p>{copy.heroCopy}</p>
              </div>
              <div className="pulse-command-actions">
                <button type="button" onClick={() => activeTicket && onOpenTicket(activeTicket)} disabled={!activeTicket}>
                  Open pass
                </button>
                <button
                  type="button"
                  disabled={!activeTicket || !canListTicket(activeTicket)}
                  onClick={() => activeTicket && canListTicket(activeTicket) && onListTicket(activeTicket)}
                >
                  List for resale
                </button>
              </div>
            </section>
            <section className="pulse-command-ledger">
              <div className="panel-heading">
                <span>{surface === "orders" ? "Order ledger" : "Pass ledger"}</span>
                <strong>{surface === "orders" ? `${visibleOrders.length} orders` : `${drawerTickets.length} passes`}</strong>
              </div>
              {(surface === "orders" ? visibleOrders : drawerTickets.slice(0, 4)).map((item) => {
                if ("side" in item) {
                  const orderEvent = showcase.find((show) => show.id === item.eventId) ?? event;
                  const presentation = orderPresentationFor(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`pulse-ledger-row ${orderToneClass(presentation.tone)}`}
                      onClick={() => onOpenEvent(orderEvent)}
                    >
                      <span>{presentation.safeOrderRef}</span>
                      <strong>{headlineFor(orderEvent)}</strong>
                      <p>{item.side} / {presentation.paymentState} / {presentation.settlementState}</p>
                      <em>{formatMoney(item.total, orderEvent.ticketTypes[0]?.currency ?? "HKD")}</em>
                    </button>
                  );
                }

                const lifecycle = ticketLifecycleCopy(item.status);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`pulse-ledger-row ticket-${lifecycle.statusClass}`}
                    onClick={() => onOpenTicket(item)}
                  >
                    <span>{item.code}</span>
                    <strong>{lifecycle.drawerState}</strong>
                    <p>{lifecycle.drawerDetail}</p>
                    <em>{formatMoney(item.paid, currency)}</em>
                  </button>
                );
              })}
            </section>
          </div>
        </div>
        <div className="pulse-status-rail" aria-label={`${copy.drawerTitle} summary`}>
          {walletStats.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
          <p>{copy.summary}</p>
        </div>
        <div className="pulse-context-strip">
          {showcase.slice(0, 3).map((item) => (
            <button key={item.id} type="button" onClick={() => onOpenEvent(item)}>
              <img src={heroImageFor(item)} alt="" />
              <span>{formatShortDate(item.startsAt)}</span>
              <strong>{headlineFor(item)}</strong>
              <p>{formatMoney(lowestPrice(item), item.ticketTypes[0]?.currency ?? "HKD")} floor</p>
            </button>
          ))}
        </div>
        <div className="pulse-activity-strip">
          <section>
            <div className="panel-heading"><span>{copy.activityTitle}</span><strong>{visibleOrders.length} synced</strong></div>
            {visibleOrders.map((order) => {
              const orderEvent = showcase.find((item) => item.id === order.eventId) ?? event;
              const presentation = orderPresentationFor(order);
              return (
                <div key={order.id} className={`pulse-order-row ${orderToneClass(presentation.tone)}`}>
                  <span>{presentation.paymentState}</span>
                  <strong>{headlineFor(orderEvent)}</strong>
                  <p>{presentation.safeOrderRef} / {order.side} / {formatMoney(order.total, orderEvent.ticketTypes[0]?.currency ?? "HKD")}</p>
                  <em>{presentation.settlementState}</em>
                </div>
              );
            })}
          </section>
          <section>
            <div className="panel-heading"><span>Pass controls</span><strong>API-backed</strong></div>
            {["Ticket state loaded from backend", "Sell action moves active pass to market", "Order totals reconcile with API"].map((item) => (
              <p key={item}><span />{item}</p>
            ))}
          </section>
        </div>
      </div>
      <aside className="tickets-drawer">
        <div className="panel-heading drawer-heading">
          <span>{copy.drawerTitle}</span>
          <button type="button" aria-label="Close tickets drawer" onClick={() => onNavigate("discover")}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="drawer-tabs">
          <button type="button">{copy.primaryTab}</button>
          <button type="button">{copy.secondaryTab}</button>
        </div>
        {drawerTickets.map((ticket, index) => (
          <article
            key={ticket.id}
            className={ticket.status === "Listed" ? "listed" : ""}
            data-ticket-status={ticketLifecycleCopy(ticket.status).statusClass}
          >
            <img src={heroImageFor(event)} alt="" />
            <div>
              <span className="ticket-date-badge">{formatShortDate(event.startsAt)}</span>
              <small>{formatDate(event.startsAt)}</small>
              <h3>{headlineFor(event)}</h3>
              <p>{sublineFor(event)}</p>
              <div className="ticket-seat-grid">
                <small>Section <b>{index === 0 ? "208" : "137"}</b></small>
                <small>Row <b>{index === 0 ? "5" : "12"}</b></small>
                <small>Seat <b>{index === 0 ? "11-12" : "6"}</b></small>
              </div>
              <em>
                {drawerStatusText(ticket, selectedTicketType?.currency ?? "HKD")}
              </em>
              <button className="ticket-open-link" type="button" onClick={() => onOpenTicket(ticket)}>
                Open ticket detail
              </button>
            </div>
            <ProofTile code={ticket.code} label={`Proof tile for ${headlineFor(event)}`} />
          </article>
        ))}
        <div className="drawer-actions">
          <button type="button" onClick={() => onNavigate("wallet")}>Transfer</button>
          <button
            type="button"
            disabled={!activeTicket || !canListTicket(activeTicket)}
            onClick={() => activeTicket && canListTicket(activeTicket) && onListTicket(activeTicket)}
          >
            Sell
          </button>
        </div>
      </aside>
      <aside className={`order-card ${orderToneClass(latestOrderPresentation.tone)}`}>
        <div className="panel-heading"><span>Your order</span><strong>{latestOrderPresentation.proofState}</strong></div>
        <div className="order-mini">
          <img src={heroImageFor(latestOrderEvent)} alt="" />
          <div>
            <strong>{headlineFor(latestOrderEvent)}</strong>
            <p>{formatDate(latestOrderEvent.startsAt)}<br />{latestOrderEvent.venue}</p>
          </div>
        </div>
        <dl>
          <div><dt>Tickets</dt><dd>{latestOrder?.side ?? "Buy"} x {formatMoney(orderTotal, currency)}</dd></div>
          <div><dt>Fees</dt><dd>{formatMoney(orderFee, currency)}</dd></div>
          <div><dt>Delivery</dt><dd>Free</dd></div>
          <div><dt>Order total</dt><dd>{formatMoney(orderTotal + orderFee, currency)}</dd></div>
        </dl>
        <div className="order-settlement-card">
          <span>{latestOrderPresentation.safeOrderRef}</span>
          <strong>{latestOrderPresentation.title}</strong>
          <p>{latestOrderPresentation.summary}</p>
          <div>
            <small>Payment <b>{latestOrderPresentation.paymentState}</b></small>
            <small>Settlement <b>{latestOrderPresentation.settlementState}</b></small>
          </div>
          <section className="order-provenance-list" aria-label="Safe order provenance">
            {latestOrderPresentation.provenance.map((item) => (
              <article key={item.key} className={orderToneClass(item.tone)}>
                <span>{item.label}</span>
                <strong>{item.state}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </section>
        </div>
        <button type="button" onClick={() => onOpenEvent(event)}>Buy now</button>
        <div className="order-timeline" aria-label="Order timeline">
          {latestOrderPresentation.steps.map((item) => (
            <p key={item.key} className={item.done ? `done ${orderToneClass(item.tone)}` : "order-tone-pending"}>
              <CheckCircle2 size={13} strokeWidth={2.4} />
              <span>{item.label}</span>
            </p>
          ))}
        </div>
        <div className="order-trust-stack">
          <p><span><ShieldCheck size={14} strokeWidth={2} /></span> Buyer guarantee <small>Verified tickets or your money back.</small></p>
          <p><span><LockKeyhole size={14} strokeWidth={2} /></span> Secure checkout <small>Order state reconciles with FanPass API.</small></p>
        </div>
      </aside>
    </section>
  );
}

function pulseCopyFor(surface: Extract<AppView, "tickets" | "wallet" | "orders">) {
  switch (surface) {
    case "wallet":
      return {
        drawerTitle: "Wallet",
        primaryTab: "Active",
        secondaryTab: "Listed",
        activityTitle: "Wallet ledger",
        workspaceKicker: "Wallet workspace",
        workspaceTitle: "Passes, proof, and resale controls",
        workspaceMeta: "API-backed wallet",
        heroEyebrow: "Active pass focus",
        heroCopy: "Review the holder-safe ticket state, proof tile, and resale eligibility before event day.",
        summary: "Ticket ownership, listing state, and order totals stay synchronized with the FanPass API.",
      };
    case "orders":
      return {
        drawerTitle: "Orders",
        primaryTab: "Recent",
        secondaryTab: "Archived",
        activityTitle: "Order history",
        workspaceKicker: "Order workspace",
        workspaceTitle: "Payment and settlement ledger",
        workspaceMeta: "Safe order refs",
        heroEyebrow: "Latest settlement focus",
        heroCopy: "Every order keeps payment authorization, trade outcome, and ticket delivery state visible without exposing provider internals.",
        summary: "Every reservation keeps a visible status, fee line, and protected ticket outcome.",
      };
    default:
      return {
        drawerTitle: "My Tickets",
        primaryTab: "Upcoming",
        secondaryTab: "Past",
        activityTitle: "Order history",
        workspaceKicker: "Ticket workspace",
        workspaceTitle: "Your verified ticket control room",
        workspaceMeta: "Entry-ready passes",
        heroEyebrow: "Next pass focus",
        heroCopy: "Open the pass detail, refresh the entry code when eligible, or move a transferable ticket into the resale market.",
        summary: "Verified passes stay ready for transfer, resale, or event-day review from one surface.",
      };
  }
}

function canListTicket(ticket: UserTicket) {
  return isTicketListable(ticket);
}

function drawerStatusText(ticket: UserTicket, currency: string) {
  const lifecycle = ticketLifecycleCopy(ticket.status);
  if (ticket.status === "Listed") {
    return `Listed ${formatMoney(ticket.paid, currency)} ea`;
  }
  return `${lifecycle.drawerState} / ${lifecycle.drawerDetail}`;
}

function ProofTile({ code, label }: { code: string; label: string }) {
  const cells = proofCellsFor(code);

  return (
    <div className="qr-box proof-tile" role="img" aria-label={label}>
      <div className="proof-grid" aria-hidden="true">
        {cells.map((active, index) => (
          <span key={`${code}-${index}`} className={active ? "active" : ""} />
        ))}
      </div>
      <small>{code.slice(-4)}</small>
    </div>
  );
}

function proofCellsFor(code: string) {
  let seed = 17;
  for (const char of code) {
    seed = (seed * 31 + char.charCodeAt(0)) % 9973;
  }

  return Array.from({ length: 81 }, (_, index) => {
    const x = index % 9;
    const y = Math.floor(index / 9);
    const finder =
      (x <= 2 && y <= 2) ||
      (x >= 6 && y <= 2) ||
      (x <= 2 && y >= 6);
    if (finder) {
      const localX = x <= 2 ? x : x - 6;
      const localY = y <= 2 ? y : y - 6;
      return localX === 0 || localX === 2 || localY === 0 || localY === 2 || (localX === 1 && localY === 1);
    }

    return (seed + index * 37 + x * 11 + y * 19) % 7 < 3;
  });
}
