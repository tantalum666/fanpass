import type { UserOrder, UserTicket } from "../types";

export type OrderPresentationTone =
  | "ready"
  | "pending"
  | "listed"
  | "settled"
  | "blocked";

export interface OrderPresentationStep {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  tone: OrderPresentationTone;
}

export interface OrderProvenanceItem {
  key: string;
  label: string;
  state: string;
  detail: string;
  tone: OrderPresentationTone;
}

export interface OrderPresentation {
  safeOrderRef: string;
  title: string;
  summary: string;
  paymentState: string;
  settlementState: string;
  proofState: string;
  tone: OrderPresentationTone;
  steps: OrderPresentationStep[];
  provenance: OrderProvenanceItem[];
}

export function orderPresentationFor(order: UserOrder | null | undefined): OrderPresentation {
  if (!order) {
    return {
      safeOrderRef: "No order",
      title: "No linked order",
      summary: "This surface is showing ticket state only. Payment and trade history will appear after an order is linked.",
      paymentState: "Not linked",
      settlementState: "Not linked",
      proofState: "Ticket only",
      tone: "pending",
      steps: [
        {
          key: "order",
          label: "Order link",
          detail: "No safe order reference is attached to this ticket yet.",
          done: false,
          tone: "pending",
        },
        {
          key: "payment",
          label: "Payment",
          detail: "Payment state is unavailable until an order is linked.",
          done: false,
          tone: "pending",
        },
        {
          key: "settlement",
          label: "Ticket outcome",
          detail: "Ticket lifecycle remains the authoritative source.",
          done: false,
          tone: "pending",
        },
      ],
      provenance: provenanceForOrder(null),
    };
  }

  const safeOrderRef = safeOrderFragment(order.id);
  const isSell = order.side === "Sell";

  switch (order.status) {
    case "Confirmed":
      return {
        safeOrderRef,
        title: isSell ? "Sell order settled" : "Purchase settled",
        summary: isSell
          ? "The resale order settled under organizer rules. Seller payout remains a separate test-mode/manual concept until Connect is scoped."
          : "Payment authorization and ticket transfer are reconciled into the wallet. Raw payment and buyer details stay server-side.",
        paymentState: isSell ? "Payout pending" : "Authorized",
        settlementState: isSell ? "Ticket transferred" : "Ticket received",
        proofState: "Settled",
        tone: "settled",
        steps: [
          step("reserve", isSell ? "Listing accepted" : "Order reserved", "FanPass created a safe order reference.", true, "ready"),
          step("payment", "Payment authorized", "Payment state is server-owned and redacted in web.", true, "ready"),
          step("settlement", isSell ? "Resale settled" : "Ticket transferred", "Wallet and order history have reconciled.", true, "settled"),
        ],
        provenance: provenanceForOrder(order),
      };
    case "Listed":
      return {
        safeOrderRef,
        title: "Listing live",
        summary: "Your sell order is visible in the market. Entry is paused until the listing is cancelled or matched.",
        paymentState: "Awaiting buyer",
        settlementState: "Open listing",
        proofState: "Listed",
        tone: "listed",
        steps: [
          step("reserve", "Listing accepted", "Ownership and resale cap checks passed.", true, "ready"),
          step("payment", "Buyer payment", "No buyer authorization has settled yet.", false, "pending"),
          step("settlement", "Transfer", "Ticket transfer waits for a matched order.", false, "listed"),
        ],
        provenance: provenanceForOrder(order),
      };
    case "Authorized":
      return {
        safeOrderRef,
        title: "Payment authorized",
        summary: "Payment authorization is recorded, but ticket issue or transfer still waits for backend reconciliation.",
        paymentState: "Authorized",
        settlementState: "Pending",
        proofState: "Pending",
        tone: "pending",
        steps: [
          step("reserve", isSell ? "Listing accepted" : "Order reserved", "FanPass created a safe order reference.", true, "ready"),
          step("payment", "Payment authorized", "Authorization is recorded without exposing client secret data.", true, "ready"),
          step("settlement", isSell ? "Awaiting buyer transfer" : "Awaiting issue", "Ticket outcome is still pending.", false, "pending"),
        ],
        provenance: provenanceForOrder(order),
      };
    case "Cancelled":
      return cancelledPresentation(safeOrderRef, isSell ? "Listing cancelled" : "Order cancelled");
    case "Failed":
      return blockedPresentation(safeOrderRef, "Payment failed", "The payment attempt failed. No ticket issue or transfer should be shown as complete.");
    case "Expired":
      return blockedPresentation(safeOrderRef, "Reservation expired", "The reservation window expired before settlement. Start a new order to continue.");
    case "Refunded":
      return {
        safeOrderRef,
        title: "Refund recorded",
        summary: "Refund state is recorded server-side. Ticket entry, resale, and transfer should remain closed.",
        paymentState: "Refunded",
        settlementState: "Closed",
        proofState: "Refunded",
        tone: "blocked",
        steps: [
          step("reserve", "Order found", "Safe order reference remains in history.", true, "ready"),
          step("payment", "Refunded", "Refund details stay outside the web UI.", true, "blocked"),
          step("settlement", "Ticket closed", "Ticket lifecycle should disable entry and resale.", true, "blocked"),
        ],
        provenance: provenanceForOrder(order),
      };
    case "Reserved":
    default:
      return {
        safeOrderRef,
        title: isSell ? "Listing reserved" : "Order reserved",
        summary: isSell
          ? "Sell order reservation exists, but the listing has not reached a settled trade state."
          : "The order has a safe reservation reference. Payment and issue remain pending.",
        paymentState: "Pending",
        settlementState: "Reserved",
        proofState: "Pending",
        tone: "pending",
        steps: [
          step("reserve", isSell ? "Listing reserved" : "Order reserved", "FanPass created a safe order reference.", true, "ready"),
          step("payment", "Payment authorization", "Waiting for server-owned authorization state.", false, "pending"),
          step("settlement", isSell ? "Market match" : "Ticket issue", "Wallet outcome is not settled yet.", false, "pending"),
        ],
        provenance: provenanceForOrder(order),
      };
  }
}

export function relatedOrderForTicket(ticket: UserTicket, orders: UserOrder[]) {
  return (
    orders.find((order) => order.ticketId === ticket.id) ??
    orders.find(
      (order) =>
        order.eventId === ticket.eventId &&
        order.ticketTypeId === ticket.ticketTypeId &&
        order.status === "Confirmed",
    ) ??
    null
  );
}

export function orderToneClass(tone: OrderPresentationTone) {
  return `order-tone-${tone}`;
}

function step(
  key: string,
  label: string,
  detail: string,
  done: boolean,
  tone: OrderPresentationTone,
): OrderPresentationStep {
  return { key, label, detail, done, tone };
}

function cancelledPresentation(safeOrderRef: string, title: string): OrderPresentation {
  return {
    safeOrderRef,
    title,
    summary: "The order was cancelled before settlement. Ticket ownership should reconcile back to the eligible holder state.",
    paymentState: "Cancelled",
    settlementState: "Closed",
    proofState: "Cancelled",
    tone: "blocked",
    steps: [
      step("reserve", "Order found", "Safe order reference remains in history.", true, "ready"),
      step("payment", "Cancelled", "No live payment claim is made from the web UI.", true, "blocked"),
      step("settlement", "No transfer", "Ticket outcome did not settle.", true, "blocked"),
    ],
    provenance: provenanceForCancelled(),
  };
}

function blockedPresentation(
  safeOrderRef: string,
  title: string,
  summary: string,
): OrderPresentation {
  return {
    safeOrderRef,
    title,
    summary,
    paymentState: "Blocked",
    settlementState: "Closed",
    proofState: "Blocked",
    tone: "blocked",
    steps: [
      step("reserve", "Order found", "Safe order reference remains in history.", true, "ready"),
      step("payment", title, "Payment state blocks issue or transfer.", true, "blocked"),
      step("settlement", "No ticket change", "Ticket outcome remains closed until a new order succeeds.", true, "blocked"),
    ],
    provenance: provenanceForBlocked(title),
  };
}

function safeOrderFragment(orderId: string) {
  const compact = orderId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `ORD-${compact.slice(-6).padStart(6, "0")}`;
}

function provenanceForOrder(order: UserOrder | null): OrderProvenanceItem[] {
  if (!order) {
    return [
      provenance("order", "Order reference", "Not linked", "No safe order reference is attached to this ticket yet.", "pending"),
      provenance("payment", "Payment signal", "Unavailable", "Payment provenance appears only after a server-owned order exists.", "pending"),
      provenance("wallet", "Wallet outcome", "Ticket only", "Ticket lifecycle remains the authoritative source.", "pending"),
    ];
  }

  switch (order.status) {
    case "Confirmed":
      return order.side === "Sell"
        ? [
            provenance("match", "Market match", "Settled", "A buyer matched the listing under the server-owned resale rule path.", "settled"),
            provenance("transfer", "Ticket transfer", "Reconciled", "Wallet ownership has moved without exposing buyer or seller identifiers.", "settled"),
            provenance("payout", "Seller payout", "Separated", "Payout evidence stays outside this web surface until a Connect path is scoped.", "pending"),
          ]
        : [
            provenance("auth", "Payment signal", "Authorized", "Authorization state is reflected from the backend without client secret data.", "ready"),
            provenance("capture", "Capture decision", "Reconciled", "Capture or settlement outcome is shown as a safe state, not as provider ids.", "settled"),
            provenance("wallet", "Wallet issue", "Delivered", "Ticket delivery is reconciled into the wallet and proof history.", "settled"),
          ];
    case "Authorized":
      return [
        provenance("auth", "Payment signal", "Authorized", "Backend order state has authorization, with provider internals redacted.", "ready"),
        provenance("capture", "Capture decision", "Pending", "Ticket issue or transfer waits for server reconciliation.", "pending"),
        provenance("wallet", "Wallet outcome", "Pending", "No completed ticket outcome is claimed yet.", "pending"),
      ];
    case "Listed":
      return [
        provenance("rules", "Listing checks", "Passed", "Ownership and resale-cap checks accepted this listing.", "ready"),
        provenance("payment", "Buyer payment", "Waiting", "No buyer authorization has settled yet.", "pending"),
        provenance("transfer", "Transfer outcome", "Open", "Ticket transfer waits for a matched order.", "listed"),
      ];
    case "Cancelled":
      return [
        provenance("order", "Order reference", "Closed", "The safe order reference remains in history.", "ready"),
        provenance("payment", "Payment signal", "Cancelled", "No live payment claim is made from this web surface.", "blocked"),
        provenance("wallet", "Wallet outcome", "No transfer", "Ticket state should reconcile back to the eligible holder path.", "blocked"),
      ];
    case "Failed":
      return provenanceForBlocked("Payment failed");
    case "Expired":
      return [
        provenance("order", "Reservation", "Expired", "The reservation window closed before settlement.", "blocked"),
        provenance("payment", "Payment signal", "Not settled", "No successful authorization or capture is shown.", "blocked"),
        provenance("wallet", "Wallet outcome", "No ticket change", "Start a new order to continue.", "blocked"),
      ];
    case "Refunded":
      return [
        provenance("refund", "Refund signal", "Recorded", "Refund state is retained server-side without exposing provider ids.", "blocked"),
        provenance("payment", "Payment outcome", "Refunded", "The web UI shows only the safe refund state.", "blocked"),
        provenance("wallet", "Wallet outcome", "Closed", "Entry, resale, and transfer should remain disabled.", "blocked"),
      ];
    case "Reserved":
    default:
      return [
        provenance("order", "Reservation", "Created", "FanPass created a safe order reference.", "ready"),
        provenance("payment", "Payment signal", "Pending", "Waiting for server-owned authorization state.", "pending"),
        provenance("wallet", "Wallet outcome", "Pending", "Wallet delivery has not settled yet.", "pending"),
      ];
  }
}

function provenanceForBlocked(title: string): OrderProvenanceItem[] {
  return [
    provenance("order", "Order reference", "Closed", "The safe order reference remains in history.", "ready"),
    provenance("payment", "Payment signal", title, "Payment state blocks issue or transfer.", "blocked"),
    provenance("wallet", "Wallet outcome", "No ticket change", "Ticket outcome remains closed until a new order succeeds.", "blocked"),
  ];
}

function provenanceForCancelled(): OrderProvenanceItem[] {
  return [
    provenance("order", "Order reference", "Closed", "The safe order reference remains in history.", "ready"),
    provenance("payment", "Payment signal", "Cancelled", "No live payment claim is made from this web surface.", "blocked"),
    provenance("wallet", "Wallet outcome", "No transfer", "Ticket state should reconcile back to the eligible holder path.", "blocked"),
  ];
}

function provenance(
  key: string,
  label: string,
  state: string,
  detail: string,
  tone: OrderPresentationTone,
): OrderProvenanceItem {
  return { key, label, state, detail, tone };
}
