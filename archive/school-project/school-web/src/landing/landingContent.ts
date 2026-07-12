export type HeroAction = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type SignalTone = "cyan" | "green" | "violet" | "amber" | "magenta";

export type TicketSignal = {
  label: string;
  value: string;
  tone: SignalTone;
};

export type StoryVisual = "lifecycle" | "infrastructure" | "resale" | "prices" | "access" | "handoff";

export type StorySection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  signals: TicketSignal[];
  visual: StoryVisual;
};

export const heroActions: HeroAction[] = [
  { label: "Explore concept", href: "#lifecycle", variant: "primary" },
  { label: "View architecture", href: "#infrastructure", variant: "secondary" }
];

export const heroSignals: TicketSignal[] = [
  { label: "Identity", value: "Verified Ticket", tone: "cyan" },
  { label: "Policy", value: "Organizer rules active", tone: "green" },
  { label: "Market", value: "Transparent Prices", tone: "violet" }
];

export const engineSteps: TicketSignal[] = [
  { label: "Auth", value: "Fan account resolved", tone: "cyan" },
  { label: "Rules", value: "Transfer policy checked", tone: "green" },
  { label: "Payment", value: "Settlement reconciled", tone: "violet" },
  { label: "Proof", value: "Ownership history updated", tone: "magenta" }
];

export const storySections: StorySection[] = [
  {
    id: "lifecycle",
    eyebrow: "Our belief",
    title: "A ticket should remember its whole journey.",
    body:
      "FanPass is built around a simple idea: access should not lose trust after the first sale. Issue, ownership, resale, refund, and entry all stay connected to one ticket lifecycle.",
    visual: "lifecycle",
    signals: [
      { label: "Issue", value: "Official source", tone: "cyan" },
      { label: "History", value: "Readable proof", tone: "green" }
    ]
  },
  {
    id: "infrastructure",
    eyebrow: "How it works",
    title: "Infrastructure underneath. A normal ticket app on top.",
    body:
      "Login, payment authorization, resale rules, order matching, proof sync, and audit history are handled behind typed service boundaries so fans see clear ticket states instead of crypto or provider complexity.",
    visual: "infrastructure",
    signals: [
      { label: "Account", value: "Embedded wallet hidden", tone: "cyan" },
      { label: "Settlement", value: "Worker-backed reconciliation", tone: "violet" }
    ]
  },
  {
    id: "resale",
    eyebrow: "Controlled resale",
    title: "Fan-to-fan transfer without turning tickets into speculation.",
    body:
      "Organizers can define caps, transfer limits, and eligibility rules. Sellers get a compliant path for idle tickets; buyers get a source-labelled resale ticket with policy context.",
    visual: "resale",
    signals: [
      { label: "Resale cap", value: "HKD 1,420", tone: "amber" },
      { label: "Policy result", value: "Secure Resale", tone: "green" }
    ]
  },
  {
    id: "prices",
    eyebrow: "Transparent prices",
    title: "Price context designed for fans, not traders.",
    body:
      "FanPass shows face value, verified sale ranges, organizer caps, and simple demand signals so a resale price has context without exposing a trading terminal.",
    visual: "prices",
    signals: [
      { label: "Face value", value: "HKD 980", tone: "cyan" },
      { label: "Recent verified sales", value: "Below cap", tone: "violet" }
    ]
  },
  {
    id: "access",
    eyebrow: "Fan access",
    title: "Reward real fans before the rush starts.",
    body:
      "Fan Access can turn meaningful participation into priority eligibility, waitlist boosts, or non-transferable badges, reducing the pressure to chase inflated resale tickets later.",
    visual: "access",
    signals: [
      { label: "Badge", value: "Access Badge earned", tone: "magenta" },
      { label: "Eligibility", value: "Original-price priority", tone: "green" }
    ]
  },
  {
    id: "handoff",
    eyebrow: "Review path",
    title: "A web entry point for the product story.",
    body:
      "This browser surface introduces the FanPass model, then leaves room for demo routes across events, tickets, resale, and proof history. It uses fictional data and does not process live purchases.",
    visual: "handoff",
    signals: [
      { label: "Data", value: "Fictional review data", tone: "cyan" },
      { label: "Release", value: "No live purchase claims", tone: "amber" }
    ]
  }
];

export const proofTimeline = [
  "Issued by official organizer",
  "Ticket assigned to fan account",
  "Resale rule evaluated",
  "Proof & History updated"
];

export const architectureLayers = [
  "Privy account sync",
  "Stripe test-mode payment boundary",
  "Off-chain orderbook",
  "On-chain proof sync",
  "Audit and lifecycle state"
];

export const accessSteps = ["Join", "Prove", "Earn", "Priority"];

export const pricePoints = [
  { label: "Face", value: 980 },
  { label: "Low", value: 1060 },
  { label: "Recent", value: 1180 },
  { label: "Cap", value: 1420 }
];
