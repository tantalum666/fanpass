import {
  accessSteps,
  architectureLayers,
  engineSteps,
  heroActions,
  heroSignals,
  pricePoints,
  proofTimeline,
  storySections,
  type SignalTone,
  type StorySection,
  type TicketSignal
} from "./landingContent";

function SignalPill({ signal }: { signal: TicketSignal }) {
  return (
    <span className={`signal-pill signal-${signal.tone}`}>
      <span>{signal.label}</span>
      <strong>{signal.value}</strong>
    </span>
  );
}

function Header() {
  return (
    <header className="site-header" aria-label="FanPass Web navigation">
      <a className="brand-lockup" href="#top" aria-label="FanPass home">
        <img src="/brand/fanpass-horizontal-lockup-v4.svg" alt="FanPass" />
      </a>
      <nav className="site-nav" aria-label="Landing sections">
        <a href="#lifecycle">Belief</a>
        <a href="#infrastructure">Architecture</a>
        <a href="#resale">Resale</a>
        <a href="#prices">Prices</a>
        <a href="#access">Fan Access</a>
      </nav>
      <a className="header-cta" href="#lifecycle">
        Explore concept
      </a>
    </header>
  );
}

function MiniTicket({ tone = "cyan" }: { tone?: SignalTone }) {
  return (
    <div className={`mini-ticket mini-ticket-${tone}`} aria-label="Verified ticket object">
      <div className="mini-ticket-head">
        <img src="/brand/fanpass-mark-v4.svg" alt="" aria-hidden="true" />
        <span>Verified Ticket</span>
      </div>
      <strong>Night Pass 02</strong>
      <div className="mini-ticket-meta">
        <span>Face Value</span>
        <span>HKD 980</span>
      </div>
      <div className="mini-ticket-meta">
        <span>Rule</span>
        <span>Cap active</span>
      </div>
    </div>
  );
}

function ProofEngine() {
  return (
    <div className="proof-engine" aria-label="FanPass lifecycle infrastructure preview">
      <div className="engine-glow" aria-hidden="true" />
      <div className="engine-rail rail-one" aria-hidden="true" />
      <div className="engine-rail rail-two" aria-hidden="true" />
      <div className="engine-center">
        <MiniTicket />
      </div>
      {engineSteps.map((step, index) => (
        <div className={`engine-node node-${index + 1}`} key={step.label}>
          <span>{step.label}</span>
          <strong>{step.value}</strong>
        </div>
      ))}
      <div className="engine-ledger">
        {proofTimeline.map((item, index) => (
          <span key={item} style={{ "--delay": `${index * 140}ms` } as React.CSSProperties}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function LifecycleVisual() {
  return (
    <div className="lifecycle-visual" aria-label="Ticket lifecycle preview">
      <MiniTicket tone="green" />
      <div className="lifecycle-stack">
        {proofTimeline.map((item, index) => (
          <div className="timeline-row" key={item}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfrastructureVisual() {
  return (
    <div className="architecture-visual" aria-label="Technology architecture preview">
      <div className="architecture-core">
        <img src="/brand/fanpass-mark-v4.svg" alt="" aria-hidden="true" />
        <strong>Ticket Lifecycle API</strong>
      </div>
      <div className="architecture-layers">
        {architectureLayers.map((layer, index) => (
          <span key={layer} style={{ "--layer-index": index } as React.CSSProperties}>
            {layer}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResaleVisual() {
  return (
    <div className="policy-visual" aria-label="Controlled resale policy preview">
      <div className="policy-scan">
        <span>Seller asks</span>
        <strong>HKD 1,240</strong>
      </div>
      <div className="policy-meter">
        <span />
      </div>
      <div className="policy-scan">
        <span>Organizer cap</span>
        <strong>HKD 1,420</strong>
      </div>
      <div className="policy-result">Secure Resale approved</div>
    </div>
  );
}

function PriceVisual() {
  const max = Math.max(...pricePoints.map((point) => point.value));
  const min = Math.min(...pricePoints.map((point) => point.value));

  return (
    <div className="price-visual" aria-label="Transparent price preview">
      <div className="price-summary">
        <span>Transparent Prices</span>
        <strong>HKD 980 face value</strong>
      </div>
      <div className="price-track">
        {pricePoints.map((point) => {
          const height = 30 + ((point.value - min) / (max - min)) * 70;
          return (
            <div className="price-bar" key={point.label}>
              <span style={{ height: `${height}%` }} />
              <em>{point.label}</em>
            </div>
          );
        })}
      </div>
      <p>Verified sale context stays below the organizer cap.</p>
    </div>
  );
}

function AccessVisual() {
  return (
    <div className="access-visual" aria-label="Fan Access badge preview">
      <div className="access-badge">
        <img src="/brand/fanpass-mark-v4.svg" alt="" aria-hidden="true" />
        <strong>Access Badge</strong>
        <span>Priority eligibility</span>
      </div>
      <div className="access-steps">
        {accessSteps.map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>
    </div>
  );
}

function HandoffVisual() {
  return (
    <div className="handoff-visual" aria-label="Web product route preview">
      {["Events", "Tickets", "Resale", "Proof"].map((route) => (
        <span key={route}>{route}</span>
      ))}
      <strong>Fictional review data. No live purchase flow.</strong>
    </div>
  );
}

function SectionVisual({ section }: { section: StorySection }) {
  if (section.visual === "lifecycle") return <LifecycleVisual />;
  if (section.visual === "infrastructure") return <InfrastructureVisual />;
  if (section.visual === "resale") return <ResaleVisual />;
  if (section.visual === "prices") return <PriceVisual />;
  if (section.visual === "access") return <AccessVisual />;
  return <HandoffVisual />;
}

function StorySectionBlock({ section, index }: { section: StorySection; index: number }) {
  return (
    <section className={`story-section section-${section.visual}`} id={section.id}>
      <div className={`story-inner ${index % 2 === 1 ? "story-reverse" : ""}`}>
        <div className="story-copy reveal">
          <span className="section-eyebrow">{section.eyebrow}</span>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
          <div className="signal-row">
            {section.signals.map((signal) => (
              <SignalPill signal={signal} key={signal.label} />
            ))}
          </div>
        </div>
        <div className="story-visual reveal">
          <SectionVisual section={section} />
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="landing-page" id="top">
      <Header />
      <main>
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="hero-kicker">Verified ticketing infrastructure</span>
            <h1 id="hero-title">Fair access, built into every ticket.</h1>
            <p>
              FanPass connects official issuance, controlled resale, payment reconciliation, and proof history into one ticket lifecycle people can actually understand.
            </p>
            <div className="hero-actions">
              {heroActions.map((action) => (
                <a className={`button button-${action.variant}`} href={action.href} key={action.label}>
                  {action.label}
                </a>
              ))}
            </div>
            <div className="hero-signal-row">
              {heroSignals.map((signal) => (
                <SignalPill signal={signal} key={signal.label} />
              ))}
            </div>
          </div>
          <div className="hero-object">
            <ProofEngine />
          </div>
          <a className="scroll-cue" href="#lifecycle" aria-label="Continue to product belief">
            Continue
          </a>
        </section>
        {storySections.map((section, index) => (
          <StorySectionBlock section={section} index={index} key={section.id} />
        ))}
        <section className="final-cta" aria-labelledby="final-title">
          <div>
            <span className="section-eyebrow">Next web milestone</span>
            <h2 id="final-title">Turn the story into a click-through product path.</h2>
            <p>
              The landing foundation is ready for future routes across events, ticket wallet, resale, and proof history while keeping demo data fictional and purchase claims inactive.
            </p>
          </div>
          <div className="final-actions">
            <a className="button button-primary" href="#lifecycle">
              Explore concept
            </a>
            <a className="button button-secondary" href="#infrastructure">
              View architecture
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
