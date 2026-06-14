import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  History,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";
import {
  formatDate,
  formatMoney,
  headlineFor,
  heroImageFor,
  sublineFor,
} from "../lib/viewHelpers";
import {
  isTicketEntryEligible,
  isTicketListable,
  ticketLifecycleCopy,
} from "../lib/ticketLifecycle";
import { orderPresentationFor, orderToneClass } from "../lib/orderPresentation";
import type {
  EntryCredentialPreview,
  TicketProofHistoryItem,
  TicketType,
  UserOrder,
  UserTicket,
  WebEvent,
} from "../types";

interface TicketDetailViewProps {
  event: WebEvent;
  ticket: UserTicket;
  ticketType: TicketType;
  relatedOrder: UserOrder | null;
  entryCredential: EntryCredentialPreview | null;
  proofHistory: TicketProofHistoryItem[] | null;
  entryCredentialLoading: boolean;
  proofHistoryLoading: boolean;
  onBack: () => void;
  onListTicket: (ticket: UserTicket) => void;
  onOpenMarket: () => void;
  onRefreshEntryCode: () => void;
}

export function TicketDetailView({
  event,
  ticket,
  ticketType,
  relatedOrder,
  entryCredential,
  proofHistory,
  entryCredentialLoading,
  proofHistoryLoading,
  onBack,
  onListTicket,
  onOpenMarket,
  onRefreshEntryCode,
}: TicketDetailViewProps) {
  const safeTicketRef = safeFragment(ticket.id);
  const lifecycle = ticketLifecycleCopy(ticket.status);
  const canShowEntryCode = isTicketEntryEligible(ticket);
  const canList = isTicketListable(ticket);
  const entryState = lifecycle.entryState;
  const entrySeed = entryCredential?.seed ?? `${ticket.code}:${event.id}`;
  const entryCountdown = entryCredential?.expiresAt ? formatTimeRemaining(entryCredential.expiresAt) : "00:28";
  const entryMessage =
    entryCredential?.message ??
    lifecycle.entryMessage;
  const entryCredentialRef =
    entryCredential?.credentialRef ?? (canShowEntryCode ? `${safeTicketRef}-LOCAL` : "Unavailable");
  const entryCredentialSource = entryCredential?.source ?? (canShowEntryCode ? "Demo preview" : "Unavailable");
  const orderPresentation = orderPresentationFor(relatedOrder);
  const proofRows = proofRowsFor(ticket, event, ticketType, proofHistory, relatedOrder);
  const capRoom = Math.max(0, ticketType.resaleCap - ticket.paid);
  const ticketControlRows = [
    {
      label: "Holder state",
      value: lifecycle.drawerState,
      detail: lifecycle.holderBoundaryText,
    },
    {
      label: "Entry window",
      value: entryState,
      detail: canShowEntryCode ? `${entryCountdown} safe refresh` : "Entry code closed",
    },
    {
      label: "Resale guard",
      value: canList ? "Listable" : "Closed",
      detail: `${formatMoney(capRoom, ticketType.currency)} cap room`,
    },
    {
      label: "Order ref",
      value: orderPresentation.safeOrderRef,
      detail: orderPresentation.proofState,
    },
  ];
  const custodyRows = [
    {
      label: "Credential boundary",
      state: entryCredentialSource,
      detail: "Web renders a redacted, short-lived preview and never signs entry credentials locally.",
    },
    {
      label: "Lifecycle action",
      state: canList ? "Resale allowed" : lifecycle.entryProofState,
      detail: canList
        ? "Listing remains API-owned and still re-checks holder state plus organizer cap."
        : lifecycle.lifecycleHistoryText,
    },
    {
      label: "Evidence scope",
      state: proofHistoryLoading ? "Syncing" : "Safe rows",
      detail: "Proof & History rows are readable audit summaries, not raw provider, wallet, owner, or signing evidence.",
    },
  ];

  return (
    <section className="product-view ticket-detail-view" data-ticket-status={lifecycle.statusClass}>
      <button className="text-link ticket-back-link" type="button" onClick={onBack}>
        <ArrowLeft size={15} strokeWidth={2.2} />
        Back to tickets
      </button>

      <div className="ticket-detail-grid">
        <section className="ticket-pass-panel">
          <img className="ticket-pass-art" src={heroImageFor(event)} alt="" />
          <div className="ticket-pass-shade" />
          <div className="ticket-pass-copy">
            <span>{entryState}</span>
            <h1>{headlineFor(event)}</h1>
            <p>{sublineFor(event)}</p>
            <div className="ticket-meta-band">
              <div>
                <small>Date</small>
                <strong>{formatDate(event.startsAt)}</strong>
              </div>
              <div>
                <small>Section</small>
                <strong>{ticketType.section}</strong>
              </div>
              <div>
                <small>Ticket ref</small>
                <strong>{safeTicketRef}</strong>
              </div>
            </div>
          </div>
        </section>

        <aside className="entry-code-panel">
          <div className="panel-heading">
            <span>Entry code</span>
            <strong>{entryState}</strong>
          </div>
          <div className={canShowEntryCode ? "entry-code-frame" : "entry-code-frame disabled"}>
            <div className="entry-qr-tile" role="img" aria-label="Proof-safe entry code preview">
              <div className="entry-qr-grid" aria-hidden="true">
                {proofCellsFor(entrySeed).map((active, index) => (
                  <span key={`${ticket.code}-${index}`} className={active ? "active" : ""} />
                ))}
              </div>
            </div>
            <div>
              <span>{canShowEntryCode ? entryCredentialSource : "Entry disabled"}</span>
              <strong>{canShowEntryCode ? entryCountdown : "Not active"}</strong>
              <p>{entryMessage}</p>
              <small>{entryCredentialRef}</small>
            </div>
          </div>
          <div className="entry-actions">
            <button type="button" disabled={!canShowEntryCode || entryCredentialLoading} onClick={onRefreshEntryCode}>
              {entryCredentialLoading ? "Refreshing..." : "Refresh code"}
            </button>
            <button type="button" onClick={onOpenMarket}>View market</button>
          </div>
        </aside>

        <section className="ticket-control-strip" data-testid="ticket-control-strip">
          {ticketControlRows.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </section>

        <aside className={`ticket-order-panel ${orderToneClass(orderPresentation.tone)}`}>
          <div className="panel-heading">
            <span>Order settlement</span>
            <strong>{orderPresentation.proofState}</strong>
          </div>
          <div className="ticket-order-summary">
            <span>{orderPresentation.safeOrderRef}</span>
            <strong>{orderPresentation.title}</strong>
            <p>{orderPresentation.summary}</p>
          </div>
          <div className="ticket-order-states">
            <div>
              <small>Payment</small>
              <strong>{orderPresentation.paymentState}</strong>
            </div>
            <div>
              <small>Settlement</small>
              <strong>{orderPresentation.settlementState}</strong>
            </div>
          </div>
          <div className="ticket-order-provenance" aria-label="Safe order provenance">
            {orderPresentation.provenance.map((item) => (
              <article key={item.key} className={orderToneClass(item.tone)}>
                <span>{item.label}</span>
                <strong>{item.state}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
          <div className="ticket-order-steps">
            {orderPresentation.steps.map((step) => (
              <article key={step.key} className={step.done ? orderToneClass(step.tone) : "order-tone-pending"}>
                <span>{step.done ? "Done" : "Open"}</span>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </aside>

        <section className="ticket-rule-panel">
          <div className="panel-heading">
            <span>Ticket rules</span>
            <strong>{lifecycle.statusLabel}</strong>
          </div>
          <div className="ticket-rule-grid">
            <RuleItem icon={ShieldCheck} label="Verified ticket" value="Issue checked" />
            <RuleItem icon={CircleDollarSign} label="Face value" value={formatMoney(ticketType.price, ticketType.currency)} />
            <RuleItem icon={LockKeyhole} label="Resale cap" value={formatMoney(ticketType.resaleCap, ticketType.currency)} />
            <RuleItem icon={CalendarClock} label="Transfer" value={ticketType.perks[0] ?? "Policy attached"} />
          </div>
          <div className="ticket-detail-actions">
            <button type="button" disabled={!canList} onClick={() => canList && onListTicket(ticket)}>
              {canList ? "List for resale" : "Resale closed"}
            </button>
            <button type="button" onClick={onOpenMarket}>Price context</button>
          </div>
        </section>

        <section className="ticket-custody-ledger" aria-label="Ticket custody ledger">
          <div className="panel-heading">
            <span>Custody ledger</span>
            <strong>Safe readout</strong>
          </div>
          {custodyRows.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.state}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="proof-history-panel">
          <div className="panel-heading">
            <span>Proof & History</span>
            <strong>{proofHistoryLoading ? "Syncing" : "Redacted"}</strong>
          </div>
          <div className="proof-history-list">
            {proofRows.map((row) => (
              <article key={row.label}>
                <row.icon size={17} strokeWidth={2.2} />
                <div>
                  <span>{row.time}</span>
                  <strong>{row.label}</strong>
                  <p>{row.text}</p>
                </div>
                <b>{row.state}</b>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function RuleItem({
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
      <Icon size={17} strokeWidth={2.2} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function proofRowsFor(
  ticket: UserTicket,
  event: WebEvent,
  ticketType: TicketType,
  proofHistory: TicketProofHistoryItem[] | null,
  relatedOrder: UserOrder | null,
) {
  const lifecycle = ticketLifecycleCopy(ticket.status);
  const orderRows = proofRowsForOrder(relatedOrder);

  if (proofHistory?.length) {
    return [
      ...proofHistory.map((item) => ({
        icon: iconForProofRow(item.id),
        time: formatProofTimestamp(item.timestamp),
        label: item.label,
        text: item.description,
        state: item.state,
      })),
      ...orderRows,
    ];
  }

  return [
    {
      icon: TicketCheck,
      time: "Issued",
      label: "Verified issue",
      text: `${headlineFor(event)} ${ticketType.name} was assigned to the current holder.`,
      state: "OK",
    },
    {
      icon: ShieldCheck,
      time: "Ownership",
      label: "Holder boundary",
      text: `Safe ticket reference ${safeFragment(ticket.id)}: ${lifecycle.holderBoundaryText}`,
      state: "Safe",
    },
    {
      icon: History,
      time: "Lifecycle",
      label: "Transfer history",
      text: lifecycle.lifecycleHistoryText,
      state: ticket.status,
    },
    {
      icon: Clock3,
      time: "Entry",
      label: "Dynamic code window",
      text: canGenerateEntryCopy(ticket),
      state: lifecycle.entryProofState,
    },
    ...orderRows,
  ];
}

function proofRowsForOrder(relatedOrder: UserOrder | null) {
  if (!relatedOrder) {
    return [];
  }

  const presentation = orderPresentationFor(relatedOrder);
  return [
    {
      icon: ReceiptText,
      time: "Order",
      label: presentation.title,
      text: `${presentation.safeOrderRef}: ${presentation.summary}`,
      state: presentation.proofState,
    },
    {
      icon: CircleDollarSign,
      time: "Payment",
      label: "Payment state",
      text: `Visible payment state is ${presentation.paymentState}; raw payment identifiers remain server-side.`,
      state: presentation.paymentState,
    },
    {
      icon: History,
      time: "Settlement",
      label: "Trade outcome",
      text: presentation.steps[presentation.steps.length - 1]?.detail ?? presentation.settlementState,
      state: presentation.settlementState,
    },
  ];
}

function canGenerateEntryCopy(ticket: UserTicket) {
  return isTicketEntryEligible(ticket)
    ? "Entry code is short-lived and must be refreshed through the backend before venue scan."
    : ticketLifecycleCopy(ticket.status).entryMessage;
}

function iconForProofRow(id: string) {
  if (id === "issued") {
    return TicketCheck;
  }
  if (id === "holder-boundary") {
    return ShieldCheck;
  }
  if (id === "entry-code") {
    return Clock3;
  }
  return History;
}

function formatProofTimestamp(value: string) {
  if (value === "Current" || value === "Short-lived" || value === "Not recorded") {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

function formatTimeRemaining(expiresAt: string) {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function safeFragment(value: string) {
  const compact = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `FP-${compact.slice(-6).padStart(6, "0")}`;
}

function proofCellsFor(seedText: string) {
  let seed = 23;
  for (const char of seedText) {
    seed = (seed * 33 + char.charCodeAt(0)) % 15401;
  }

  return Array.from({ length: 121 }, (_, index) => {
    const x = index % 11;
    const y = Math.floor(index / 11);
    const finder =
      (x <= 3 && y <= 3) ||
      (x >= 7 && y <= 3) ||
      (x <= 3 && y >= 7);
    if (finder) {
      const localX = x <= 3 ? x : x - 7;
      const localY = y <= 3 ? y : y - 7;
      return (
        localX === 0 ||
        localX === 3 ||
        localY === 0 ||
        localY === 3 ||
        (localX >= 1 && localX <= 2 && localY >= 1 && localY <= 2)
      );
    }
    return (seed + index * 41 + x * 17 + y * 29) % 9 < 4;
  });
}
