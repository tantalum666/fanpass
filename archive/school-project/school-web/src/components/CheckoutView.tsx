import {
  Check,
  CircleDollarSign,
  Clock3,
  CreditCard,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";
import { formatDate, formatMoney, headlineFor, heroImageFor, sublineFor } from "../lib/viewHelpers";
import type { TicketType, WebEvent } from "../types";

type CheckoutMode = "primary" | "resale";

interface CheckoutViewProps {
  event: WebEvent;
  ticketType: TicketType;
  step: "select" | "authorize" | "confirm";
  mode?: CheckoutMode;
  resalePrice?: number | null;
  actionStatus?: string;
  onBack: () => void;
  onAuthorize: () => void;
  onConfirm: () => void;
}

export function CheckoutView({
  event,
  ticketType,
  step,
  mode = "primary",
  resalePrice = null,
  actionStatus,
  onBack,
  onAuthorize,
  onConfirm,
}: CheckoutViewProps) {
  const isResale = mode === "resale";
  const unitPrice = isResale && resalePrice ? resalePrice : ticketType.price;
  const fee = Math.round(unitPrice * 0.035);
  const total = unitPrice + fee;
  const nextAction = step === "confirm" ? onConfirm : onAuthorize;
  const nextLabel = step === "confirm"
    ? isResale
      ? "Confirm resale order"
      : "Confirm and issue"
    : "Authorize payment";
  const safeReference = safeCheckoutReference(event.id, ticketType.id, mode, unitPrice);
  const issueState = step === "confirm"
    ? isResale
      ? "Ready to transfer"
      : "Ready to issue"
    : step === "authorize"
      ? "Authorizing"
      : isResale
        ? "Listing held"
        : "Reserved";
  const headline = isResale ? "Secure resale checkout" : "Secure checkout";
  const finalStepLabel = isResale ? "Transfer pass" : "Issue pass";
  const capRoom = Math.max(0, ticketType.resaleCap - unitPrice);
  const controlRows = [
    {
      label: "Order ref",
      value: safeReference,
      detail: "Safe session id",
    },
    {
      label: "Price guard",
      value: unitPrice <= ticketType.resaleCap ? "Under cap" : "Blocked",
      detail: `${formatMoney(capRoom, ticketType.currency)} room`,
    },
    {
      label: "Payment",
      value: step === "select" ? "Pending" : "Authorized",
      detail: "Server-owned state",
    },
    {
      label: "Wallet outcome",
      value: step === "confirm" ? finalStepLabel : "Waiting",
      detail: "No raw provider ids",
    },
  ];
  const settlementRows = [
    {
      label: "Authorization",
      state: step === "select" ? "Waiting" : "Held",
      detail: "The web UI shows only safe payment state, never client secret or provider ids.",
    },
    {
      label: isResale ? "Transfer decision" : "Issue decision",
      state: step === "confirm" ? "Ready" : "Pending",
      detail: isResale
        ? "Resale transfer waits for backend reconciliation."
        : "Primary ticket issue waits for backend reconciliation.",
    },
    {
      label: "Refund path",
      state: "Server-owned",
      detail: "Refund and cancellation evidence stay behind the API boundary until explicitly scoped.",
    },
  ];

  return (
    <section className="product-view checkout-view checkout-concept" data-checkout-mode={mode}>
      <button className="text-link" type="button" onClick={onBack}>
        {isResale ? "Back to market" : "Back to event"}
      </button>
      <div className="checkout-grid checkout-terminal-grid">
        <div className="checkout-main checkout-command">
          <div className="checkout-event-strip">
            <img src={heroImageFor(event)} alt="" />
            <div>
              <span>{headline}</span>
              <h1>{headlineFor(event)}</h1>
              <p>{sublineFor(event)} / {formatDate(event.startsAt)}</p>
            </div>
          </div>

          <div className="checkout-steps">
            <CheckoutStep active={step === "select"} done={step !== "select"} label="Reserve" />
            <CheckoutStep active={step === "authorize"} done={step === "confirm"} label="Authorize" />
            <CheckoutStep active={step === "confirm"} done={false} label={finalStepLabel} />
          </div>

          <div className="checkout-control-strip" data-testid="checkout-control-strip">
            {controlRows.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>

          <div className="checkout-assurance-grid">
            <article>
              <CreditCard size={18} strokeWidth={2.2} />
              <span>Payment method</span>
              <strong>Demo card ending 4242</strong>
              <p>Test-mode authorization only; no live payment claim.</p>
            </article>
            <article>
              <ShieldCheck size={18} strokeWidth={2.2} />
              <span>Rule check</span>
              <strong>{isResale ? "Listing and cap re-checked" : "Cap and holder verified"}</strong>
              <p>
                {isResale
                  ? "FanPass re-validates the resale orderbook before transfer."
                  : "Order state reconciles with FanPass API before issuance."}
              </p>
            </article>
            <article>
              <LockKeyhole size={18} strokeWidth={2.2} />
              <span>Session boundary</span>
              <strong>{step === "confirm" ? issueState : isResale ? "Held for review" : "Reserved for 08:00"}</strong>
              <p>Prototype checkout avoids production credentials and real user data.</p>
            </article>
          </div>

          <div className="checkout-review-grid">
            <section className="checkout-receipt-rail">
              <div className="panel-heading">
                <span>Reservation session</span>
                <strong>{issueState}</strong>
              </div>
              <dl>
                <div>
                  <dt>Reference</dt>
                  <dd>{safeReference}</dd>
                </div>
                <div>
                  <dt>Price cap</dt>
                  <dd>{formatMoney(ticketType.resaleCap, ticketType.currency)}</dd>
                </div>
                {isResale && (
                  <div>
                    <dt>Market price</dt>
                    <dd>{formatMoney(unitPrice, ticketType.currency)}</dd>
                  </div>
                )}
                <div>
                  <dt>Fan access</dt>
                  <dd>Verified</dd>
                </div>
                <div>
                  <dt>Issuer</dt>
                  <dd>FanPass Web</dd>
                </div>
              </dl>
            </section>

            <section className="checkout-issue-preview">
              <div className="issue-pass-card">
                <img src={heroImageFor(event)} alt="" />
                <div>
                  <span>{isResale ? "Transfer preview" : "Issue preview"}</span>
                  <strong>{headlineFor(event)}</strong>
                  <p>{ticketType.section} / {ticketType.name}</p>
                </div>
                <div className="issue-proof-mark" aria-hidden="true">
                  {Array.from({ length: 25 }).map((_, index) => (
                    <span key={index} className={(index * 7 + safeReference.length) % 4 === 0 ? "on" : ""} />
                  ))}
                </div>
              </div>
              <div className="issue-state-row">
                <p><TicketCheck size={15} strokeWidth={2.2} /> {isResale ? "Resale listing held" : "Ticket band reserved"}</p>
                <p><ShieldCheck size={15} strokeWidth={2.2} /> Proof-safe details only</p>
              </div>
            </section>
          </div>
        </div>

        <aside className="order-summary checkout-order-panel">
          <div className="panel-heading">
            <span>{isResale ? "Your resale order" : "Your order"}</span>
            <strong>{step === "confirm" ? "Ready" : "Reserved"}</strong>
          </div>
          <div className="checkout-ticket-preview">
            <img src={heroImageFor(event)} alt="" />
            <div>
              <span>{ticketType.section}</span>
              <strong>{ticketType.name}</strong>
              <p>{event.venue}</p>
            </div>
            <TicketCheck size={18} strokeWidth={2.2} />
          </div>
          <dl>
            <div>
              <dt>{isResale ? "Resale ticket" : "Ticket"}</dt>
              <dd>{formatMoney(unitPrice, ticketType.currency)}</dd>
            </div>
            <div>
              <dt>Service fee</dt>
              <dd>{formatMoney(fee, ticketType.currency)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>Free</dd>
            </div>
            <div>
              <dt>Order total</dt>
              <dd>{formatMoney(total, ticketType.currency)}</dd>
            </div>
          </dl>
          <section className="checkout-settlement-ledger" aria-label="Checkout settlement ledger">
            <div className="panel-heading">
              <span>Settlement ledger</span>
              <strong>{step === "confirm" ? "Ready" : "Open"}</strong>
            </div>
            {settlementRows.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.state}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </section>
          <button type="button" onClick={nextAction}>
            {nextLabel}
          </button>
          <div className="checkout-trust-list">
            <p><ShieldCheck size={16} strokeWidth={2.2} /> Buyer guarantee</p>
            <p><LockKeyhole size={16} strokeWidth={2.2} /> Secure checkout boundary</p>
          </div>
          {actionStatus && <p className="checkout-api-status">{actionStatus}</p>}
          <div className="checkout-order-timeline">
            {[
              { icon: ReceiptText, label: isResale ? "Listing reserved" : "Order reserved", done: true },
              { icon: CircleDollarSign, label: "Payment authorization", done: step !== "select" },
              { icon: Clock3, label: finalStepLabel, done: step === "confirm" },
            ].map((item) => (
              <p key={item.label} className={item.done ? "done" : ""}>
                <item.icon size={14} strokeWidth={2.2} />
                {item.label}
              </p>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function safeCheckoutReference(eventId: string, ticketTypeId: string, mode: CheckoutMode, unitPrice: number) {
  const input = `${eventId}:${ticketTypeId}:${mode}:${unitPrice}`;
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 100000;
  }
  return `FP-${String(hash).padStart(5, "0")}`;
}

function CheckoutStep({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className={active ? "checkout-step active" : done ? "checkout-step done" : "checkout-step"}>
      <span>{done ? <Check size={14} strokeWidth={2.5} /> : ""}</span>
      <p>{label}</p>
    </div>
  );
}
