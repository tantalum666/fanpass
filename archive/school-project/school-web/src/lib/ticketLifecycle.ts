import type { UserTicket } from "../types";

export type TicketLifecycleTone =
  | "ready"
  | "listed"
  | "pending"
  | "settled"
  | "blocked";

export interface TicketLifecycleCopy {
  statusLabel: UserTicket["status"];
  statusClass: string;
  tone: TicketLifecycleTone;
  entryState: string;
  drawerState: string;
  drawerDetail: string;
  entryMessage: string;
  lifecycleHistoryText: string;
  holderBoundaryText: string;
  entryProofState: string;
}

const lifecycleRank: Record<UserTicket["status"], number> = {
  Active: 0,
  Transferred: 1,
  "Transfer Pending": 2,
  Listed: 3,
  Redeemed: 4,
  Refunded: 5,
  Cancelled: 6,
  Expired: 7,
};

export function ticketLifecycleRank(status: UserTicket["status"]) {
  return lifecycleRank[status];
}

export function isTicketEntryEligible(ticket: UserTicket) {
  return ticket.status === "Active" || ticket.status === "Transferred";
}

export function isTicketListable(ticket: UserTicket) {
  return ticket.status === "Active" || ticket.status === "Transferred";
}

export function ticketStatusClass(status: UserTicket["status"]) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

export function ticketLifecycleCopy(status: UserTicket["status"]): TicketLifecycleCopy {
  switch (status) {
    case "Active":
      return {
        statusLabel: status,
        statusClass: ticketStatusClass(status),
        tone: "ready",
        entryState: "Ready",
        drawerState: "Ready",
        drawerDetail: "Entry code available",
        entryMessage: "Backend entry preview is redacted; raw credential internals stay outside the web UI.",
        lifecycleHistoryText: "Ticket is active under organizer rules with no public transfer details exposed.",
        holderBoundaryText: "Safe ticket reference is active; full owner identifiers stay hidden.",
        entryProofState: "Ready",
      };
    case "Transferred":
      return {
        statusLabel: status,
        statusClass: ticketStatusClass(status),
        tone: "ready",
        entryState: "Ready after transfer",
        drawerState: "Transferred",
        drawerDetail: "Ownership settled",
        entryMessage: "Ownership has settled through FanPass; raw transfer and credential internals stay hidden.",
        lifecycleHistoryText: "Ownership changed under organizer rules and the current holder can use entry.",
        holderBoundaryText: "Current holder boundary is verified after transfer; raw owner identifiers stay hidden.",
        entryProofState: "Ready",
      };
    case "Listed":
      return {
        statusLabel: status,
        statusClass: ticketStatusClass(status),
        tone: "listed",
        entryState: "Paused while listed",
        drawerState: "Listed",
        drawerDetail: "Entry paused",
        entryMessage: "Entry code is paused while the ticket is listed for resale.",
        lifecycleHistoryText: "Entry is paused while the resale listing is open and resumes if the listing is cancelled.",
        holderBoundaryText: "Listing state is visible, but seller and owner identifiers remain redacted.",
        entryProofState: "Paused",
      };
    case "Transfer Pending":
      return {
        statusLabel: status,
        statusClass: ticketStatusClass(status),
        tone: "pending",
        entryState: "Transfer pending",
        drawerState: "Pending",
        drawerDetail: "Settlement running",
        entryMessage: "Entry code is unavailable while resale transfer settlement is pending.",
        lifecycleHistoryText: "Resale transfer has started and is waiting for backend settlement confirmation.",
        holderBoundaryText: "Holder boundary is being updated; raw buyer and seller identifiers stay hidden.",
        entryProofState: "Pending",
      };
    case "Redeemed":
      return {
        statusLabel: status,
        statusClass: ticketStatusClass(status),
        tone: "settled",
        entryState: "Redeemed",
        drawerState: "Redeemed",
        drawerDetail: "Entry consumed",
        entryMessage: "This ticket has already been redeemed at the venue; QR refresh is closed.",
        lifecycleHistoryText: "Ticket was redeemed at the gate and cannot generate another entry code.",
        holderBoundaryText: "Redemption proof is retained without exposing scanner, owner, or credential internals.",
        entryProofState: "Closed",
      };
    case "Cancelled":
      return {
        statusLabel: status,
        statusClass: ticketStatusClass(status),
        tone: "blocked",
        entryState: "Cancelled",
        drawerState: "Cancelled",
        drawerDetail: "Entry blocked",
        entryMessage: "This ticket has been cancelled and is not eligible for entry.",
        lifecycleHistoryText: "Ticket cancellation blocks entry and resale actions.",
        holderBoundaryText: "Cancellation proof is retained without exposing owner identifiers.",
        entryProofState: "Blocked",
      };
    case "Refunded":
      return {
        statusLabel: status,
        statusClass: ticketStatusClass(status),
        tone: "blocked",
        entryState: "Refunded",
        drawerState: "Refunded",
        drawerDetail: "Entry closed",
        entryMessage: "This ticket has been refunded and can no longer be used for entry.",
        lifecycleHistoryText: "Refund state closes entry and resale actions while retaining safe proof history.",
        holderBoundaryText: "Refund proof is retained without exposing payment or owner identifiers.",
        entryProofState: "Closed",
      };
    case "Expired":
      return {
        statusLabel: status,
        statusClass: ticketStatusClass(status),
        tone: "blocked",
        entryState: "Expired",
        drawerState: "Expired",
        drawerDetail: "Window closed",
        entryMessage: "This ticket is expired; entry code refresh is no longer available.",
        lifecycleHistoryText: "Ticket validity window has expired and entry is closed.",
        holderBoundaryText: "Expiration proof is retained without exposing owner identifiers.",
        entryProofState: "Closed",
      };
  }
}
