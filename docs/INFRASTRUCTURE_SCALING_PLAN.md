# FanPass Infrastructure Scaling And Migration Plan

Date: 2026-07-17

This is FanPass's cost/performance decision plan. It does not migrate the product at an arbitrary user count. Every upgrade requires both a business-stage trigger and measured operational evidence.

Prices are USD list-price snapshots reviewed on 2026-07-17, before tax, domains, payment fees, Privy, chain RPC, email/SMS, Apple fees, and staff cost. Recheck the official links at the end before purchasing.

## Executive Decision

1. Keep the managed-platform architecture while the product and team are small. Render plus Neon is cheaper in engineering time than operating AWS or Google Cloud directly.
2. Stop using free sleeping compute before an external production pilot. The first paid step is an always-on API, not a wholesale cloud migration.
3. Before a global closed beta, choose one initial transaction region from measured demand, organizer location, provider support and synthetic latency. Keep Oregon if the first commercial concentration is in the Americas; otherwise create matched Render and Neon resources in Frankfurt or Singapore. Render does not move services between regions in place.
4. Use Vercel only for the public web/marketing frontend. The operational Console, Console Auth, API, WebSocket feed, payments, and workers should not move there merely because a historical dashboard exists there.
5. Keep PostgreSQL as the transactional authority. Cache, queue, and edge counters can reduce load but must never allocate or oversell inventory.
6. Add Cloudflare edge protection before a high-demand sale. Caching, WAF, bot controls, signed admission, and a waiting room are more valuable then than prematurely rewriting the backend for AWS or GCP.
7. Evaluate a major cloud only when Render/Neon cannot meet global latency, availability, compliance, networking, or total-cost requirements. The default candidate for a lean team is regional Google Cloud Run services behind a global load balancer. AWS ECS/Fargate is the alternative when partner requirements, existing AWS skills, or infrastructure control justify more operations work.
8. Do not adopt Kubernetes/EKS/GKE in the stages below. FanPass does not yet have a platform team that would make that complexity economical.

## Current Runtime Boundary

| Surface | Current location | Role | Planning decision |
| --- | --- | --- | --- |
| FanPass API | Render Free web service, Oregon | NestJS, Prisma, Socket.IO, payments, inventory, auth and in-process side-effect scheduler | First service to become paid and always-on; later split worker |
| Organizer Console | Render Free web service, Oregon | Vite UI, Node BFF and HttpOnly Console session | Keep separate; Starter is sufficient initially |
| Console Auth | Render Free web service, Oregon | Isolated Privy browser-auth runtime | Keep isolated; Starter is sufficient initially |
| PostgreSQL | Neon `fanpass-staging` | Inventory, order, payment, ticket and audit authority | Keep Neon through early growth; create a separate production project |
| Public web | `apps/web`; old Vercel dashboard is historical | Public discovery/marketing candidate | Commercial use requires Vercel Pro or another commercial host |
| Background work | Timer inside API plus PostgreSQL outbox | Payment, ownership and chain side effects | Split before real-money production or horizontal API scaling |
| Shared cache/queue | Not implemented in the active API path | Needed for multi-instance rate limits, Socket.IO fan-out and cached snapshots | Add Valkey/Redis-compatible service before API count exceeds one |
| Media | Bundled/external URLs | Event/editorial artwork | Put owned/licensed assets in object storage, not PostgreSQL |

Current structural constraints:

- `render.yaml` runs all three services on Free compute in Oregon.
- Staging runs `prisma db push` during build. Production must use reviewed migrations and `prisma migrate deploy`, not schema push during an application build.
- API rate limits are process-local and are not authoritative across multiple instances.
- Socket.IO has no shared adapter, so broadcasts are single-instance.
- The side-effect scheduler runs inside the API. Multiple API instances would create competing schedulers even though the database outbox has recovery controls.
- The Neon region is not recorded in version-controlled configuration. Confirm it in the Neon dashboard; every transactional API must use a database in the same or nearest supported region.

## Global Traffic Model

Global availability should be built in layers instead of turning inventory into a multi-primary database:

1. **Global edge:** Vercel/Cloudflare serves the public web, static assets, licensed media, cacheable event catalog, artist/editorial content and safe aggregate market snapshots close to users worldwide.
2. **Global directory/control plane:** stable API hostnames resolve the relevant event and its authoritative region. Account identity is globally unique, but sensitive profile data remains subject to residency policy.
3. **Regional transaction plane:** each event is assigned one home region containing its write API, shared cache, worker and PostgreSQL authority. Purchase, hold, resale and redemption writes go to the event's region, not whichever edge happens to receive the request.
4. **Additional regions:** add a region only after there are organizers/events or regulatory requirements there. A second region is a second transaction plane, not a read/write copy of the first event's inventory.

This design gives global discovery immediately while preserving one authoritative inventory path. Cross-region replicas may support analytics or noncritical reads later, but they must never allocate tickets.

## Stage Plan And Monthly Budget

The budget ranges are planning envelopes, not quotations.

### Stage 0 — Internal Prototype And Staging

Target: current state, internal development and simulator testing, no public users, no real money.

Expected infrastructure spend: **$0-$20/month**.

- Render Free for API, Console and Console Auth.
- Neon Free for disposable development/staging data when its quotas are enough.
- Vercel Hobby only for personal, non-commercial preview work. Vercel requires Pro or Enterprise for commercial use.
- Cloudflare Free DNS/CDN/WAF when a domain is ready.
- Local PostgreSQL for deterministic tests and concurrency verification.

Cold starts, scale-to-zero, short restore windows and no availability commitment are acceptable only here. Exit immediately when an external tester depends on predictable availability, a commercial public site is published, or a real-payment pilot is scheduled.

### Stage 1 — Closed Global Beta

Target: roughly 50-300 invited testers, Stripe test mode, no public on-sale, one small engineering team.

Expected infrastructure spend: **$55-$90/month**, or **$75-$110/month** with a commercial Vercel web frontend.

| Component | Plan | Planning cost |
| --- | --- | ---: |
| API | Render Standard, 1 instance, chosen primary region | $25/month |
| Console | Render Starter, same primary region | $7/month |
| Console Auth | Render Starter, same primary region | $7/month |
| PostgreSQL | Neon Launch, nearest matching region, capped autoscaling | approximately $15-$30/month |
| Public web | Vercel Pro only when commercially active | $20/month including usage credit |
| DNS/CDN/WAF | Cloudflare Free | $0 base |

API Standard is recommended over Starter because NestJS, Prisma, Socket.IO, auth, and test-mode payments share the process. Standard provides 1 CPU/2 GB; Starter provides 0.5 CPU/512 MB.

Entry requirements:

- Select the primary region from first-organizer geography and synthetic checks from North America, Europe and APAC. Do not infer it from the demo city's copy.
- If Oregon is not the chosen primary, create parallel Render API, Console and Auth services in Frankfurt or Singapore.
- Create a separate Neon beta/production project in the matching region; do not reuse `fanpass-staging` for real users.
- Migrate the small database with unpooled `pg_dump`/`pg_restore`, a brief read-only cutover, row-count/checksum verification, and a retained rollback source.
- Replace production schema push with reviewed Prisma migrations and a controlled release step.
- Add external uptime probes, error tracking, latency metrics and billing alerts.
- Meet 99.5% monthly availability, cached public-read p95 below 300 ms from North America/Europe/APAC, primary-region transaction p95 below 350 ms, and global transaction p95 below 900 ms outside provider incidents.
- Prove RPO 24 hours and RTO 4 hours with one tested restore.

Do not add Redis/Valkey merely because it is available. Add it when Stage 2 multi-instance or fan-out work begins.

### Stage 2 — Limited Public Pilot And Real Payments

Target: roughly 1,000-10,000 MAU, real organizers, limited real-money events, normal API traffic below about 100 requests/second, no stadium-scale on-sale.

Expected infrastructure spend: **$175-$325/month** plus Privy, Stripe, messaging, chain RPC and support.

| Component | Plan/topology | Planning cost |
| --- | --- | ---: |
| Render workspace | Pro for autoscaling and environment/team controls | $25/month plus compute |
| API | 2 x Standard minimum in the primary region | $50/month |
| Console and Auth | 1 x Starter each | $14/month |
| Side-effect worker | Separate Starter or Standard | $7-$25/month |
| Shared cache/queue | Render Key Value Starter | $10/month |
| PostgreSQL | Neon Launch, warm production minimum, bounded autoscaling | approximately $25-$80/month |
| Public web | Vercel Pro | $20/month plus overage |
| Edge admission/light logic | Cloudflare Workers Paid when required | $5/month base |
| Media | Cloudflare R2 Standard | usually free initially, then usage based |
| Observability | Error, uptime, logs and traces | reserve $20-$80/month |

Before a second API instance:

- Move rate-limit counters to a shared store with bounded TTLs and fail-safe behavior.
- Add a Redis/Valkey Socket.IO adapter or replace nonessential broadcasts with a managed pub/sub boundary.
- Run the PostgreSQL outbox worker as its own service and disable the in-process worker in web instances.
- Keep idempotency at database/provider boundaries; a queue is delivery infrastructure, not business authority.
- Add graceful shutdown and WebSocket reconnect tests.
- Put owned/licensed artwork and large exports in R2 or S3-compatible storage with signed uploads and lifecycle rules.

Operational gates:

- 99.9% monthly availability.
- RPO no more than 5 minutes and RTO no more than 30 minutes for paid transaction data.
- Quarterly restore and provider-failure drills.
- Load test at twice expected ordinary peak with p95 reads below 300 ms, p95 writes below 500 ms, error rate below 1%, and no inventory invariant failure.
- Alerts for availability, payment webhook lag, outbox age, database connections and failed redemption.

### Stage 3 — Growth And High-Demand Sales

Target: roughly 10,000-100,000 MAU or scheduled events whose arrival burst is materially larger than ordinary traffic.

Expected infrastructure spend: **$400-$1,200/month** on the managed path. Database compute, multiple API/worker instances, logs and edge protection dominate the range.

Remain on Render/Neon while measured SLOs pass. Add:

- 2-4 API instances sized from load tests, with capacity pre-provisioned before an on-sale.
- Independent worker pools for payment/ownership work.
- Cached public event, price-history and inventory-summary snapshots. Exact holds, queue positions and inventory remain authenticated and PostgreSQL-authoritative.
- Cloudflare rate limits, Turnstile/bot signals and signed admission tokens.
- Cloudflare Waiting Room for major on-sales. It requires Cloudflare CDN and Business/Enterprise access unless FanPass qualifies for Project Fair Shot.
- R2 for public media and exports, with PostgreSQL storing metadata and authorization only.
- Read replicas only after query/index/cache work proves the workload is read-bound.
- A second regional transaction plane only when a second continent has sustained organizer/event demand or a hard residency requirement. Budget an additional **$150-$500/month per active region** at this stage, depending on redundancy and database load.

Neon rule:

- Stay on Launch while its 16 CU maximum, 7-day restore window and support meet requirements.
- Move to Scale for a feature requirement—30-day restore, telemetry export, private networking, IP rules, SLA/compliance—or sustained load beyond Launch. Scale's CU-hour rate is higher, so it is not an automatic cost optimization.

Admission rule:

- Never expose origin capacity directly to an unbounded on-sale surge.
- If forecast arrivals exceed proven load-test capacity, or forecast peak is more than 2x ordinary peak, enable waiting-room admission and pre-provision capacity.
- Inventory remains a single-writer transactional path. Do not introduce multi-primary inventory to reduce global read latency.

### Stage 4 — Major Cloud / Multi-Organizer Platform

Target: regular large events across multiple continents, contractual availability, jurisdiction-specific data residency, private networking, audited compliance, multiple engineering teams, or sustained traffic/cost outside the managed-platform envelope.

Expected infrastructure spend: **$2,000-$10,000+/month** for two or more properly redundant regional planes plus global edge, excluding staff. Obtain calculator estimates for every target region before approval.

Do not enter because MAU crossed an arbitrary number. Enter when at least one hard trigger below is true and the team is operationally ready.

## Upgrade And Migration Triggers

| Signal | First action | Migration action |
| --- | --- | --- |
| External user sees a Render wake screen | Move affected service from Free to paid | None |
| Cached public-read p95 exceeds 300 ms in a strategic continent | Fix CDN/cache/origin policy first | Add regional read/edge compute only if misses remain |
| Authenticated write p95 exceeds 900 ms in a strategic market | Measure provider and database path; choose nearer primary for early launch | Add an event-owned regional transaction plane when demand is sustained |
| API CPU >60% or memory >70% for 15 minutes at expected peak | Profile, fix hot paths, then scale vertically | Add instances after shared-state work |
| API p95 >500 ms or error rate >1% at ordinary peak | Trace database/provider latency and tune | Scale only after root cause |
| Database connections >60% of safe pool or query p95 >50 ms | Query/index review, pooled URL, cache read models | Increase compute; add replica only for proven read load |
| PostgreSQL storage reaches 70% of budget/limit | Retention/index review, then expand | Migrate only for feature/cost requirement |
| One API instance is no longer an acceptable failure domain | Shared rate limits, Socket.IO adapter and worker split | Run at least two instances |
| Outbox lag >60 seconds or backlog grows for 5 minutes | Scale worker and inspect provider errors | Managed queue only after outbox authority is preserved |
| On-sale forecast exceeds proven capacity or 2x ordinary peak | Waiting room, cached fan-out, pre-provision | Major cloud is optional, not first response |
| Managed-platform spend >$800/month for 3 months | Model actual workload in GCP/AWS calculators | Move only if 3-year TCO improves at least 25% after staff/ops |
| Need SLA, private networking, IP restrictions or 30-day PITR | Neon Scale/Render enterprise feasibility | Migrate if feature/price is unacceptable |
| Need data residency or low-latency transactions in another jurisdiction | Select a supported GCP/AWS region in that jurisdiction | Move that region's event API/cache/worker/database as one transaction plane |
| No infrastructure owner and no on-call rotation | Stay on managed platforms | Migration is blocked regardless of compute savings |

## AWS Versus Google Cloud

### Default Candidate: Google Cloud For A Lean Team

Target:

- Cloud Run for API, Console BFF/Auth and jobs, with minimum instances for paid paths.
- HTTPS Load Balancer plus Cloud Armor; Cloudflare may remain the public edge/waiting room.
- Cloud SQL PostgreSQL with HA when recovery requirements justify it.
- Memorystore for cache and Socket.IO coordination.
- Pub/Sub or Cloud Tasks for delivery, while the PostgreSQL outbox remains business authority.
- Cloud Storage if R2 is not retained; Secret Manager; Cloud Monitoring/Logging; OpenTelemetry.

Reasons: Cloud Run is low-operations and usage-based, Google exposes regional services across the Americas, Europe and APAC behind global routing, and the current Node services can be containerized without Kubernetes.

Trade-offs: WebSocket clients must reconnect; VPC connectors, load balancing, logs and egress are separate charges; Cloud SQL HA costs materially more than a small Neon workload.

### Choose AWS When Enterprise Control Justifies It

Target:

- ECS/Fargate behind an Application Load Balancer for API, Console services and workers.
- RDS PostgreSQL Multi-AZ.
- ElastiCache/Valkey, SQS with dead-letter queues, S3/CloudFront if R2 is not retained.
- WAF, Secrets Manager, CloudWatch and OpenTelemetry.

Choose AWS when an enterprise partner requires it, the team already has AWS/IAM/network skills, or long-running containers are preferable for steady WebSocket and worker workloads.

Trade-offs: load balancers, public IPv4, NAT, logs, storage and transfer are separate from Fargate compute; RDS Multi-AZ provisions standby capacity; IAM/networking cost more engineering time than Render/Neon.

## Migration Order

1. Make services portable: container builds, config validation, `/health/live`, `/health/ready`, graceful shutdown, OpenTelemetry, and migration-only schema deploys.
2. Decouple entry: stable custom `api`, `console`, `auth` and `media` hostnames; do not embed provider hostnames in app releases.
3. Move owned/licensed media to R2/S3-compatible storage.
4. Split the outbox worker and prove retry, idempotency, dead-letter and recovery behavior.
5. Add distributed rate limits and Socket.IO/pub-sub coordination before horizontal scaling.
6. Deploy target stateless services against a non-production target database; run contracts, load and security checks.
7. Migrate PostgreSQL with dump/restore for a small read-only window or logical replication for near-zero downtime. Never application-dual-write inventory.
8. Mirror safe public reads, then canary traffic; keep payments/writes on one authority until cutover.
9. Cut DNS and monitor latency, errors, queue lag and inventory invariants. Retain the old platform read-only for rollback for at least seven days.
10. Remove old secrets/services/databases only after backup validation and cost reconciliation.

## Cost Controls

- Separate development, staging and production projects/databases.
- Set provider alerts at 50%, 75%, 90% and 100% of the budget. Configure Vercel Spend Management instead of accepting its default on-demand budget.
- Set Neon min/max autoscaling per environment. Production may stay warm; non-production branches should scale to zero and expire.
- Keep API and database in the same/nearest region. Cross-region database calls are a latency and egress bug, not redundancy.
- Cache public data with `stale-while-revalidate`; never publicly cache private queue, payment, QR or identity payloads.
- Store media in object storage with lifecycle rules. Do not use Vercel, Render disks or PostgreSQL as an unbounded media origin.
- Sample successful traces and retain errors/security/audit events longer than verbose debug logs.
- Buy annual commitments only after three months of stable usage.
- Review cost per active fan, cost per paid order, peak RPS, database CU-hours, egress, cache hit rate and log volume monthly.

## Quarterly Capacity Review

Record before each quarter and high-demand event:

| Category | Evidence |
| --- | --- |
| Product | MAU, paid orders, organizers, events/month, expected on-sale arrivals |
| API | requests, peak RPS, p50/p95/p99, error rate, CPU and memory |
| Database | size/growth, connections, CU-hours/CPU, slow queries, lock waits, restore time |
| Async | outbox depth/age, retry/dead counts, webhook lag, worker saturation |
| Realtime | concurrent sockets, reconnects, dropped subscriptions, fan-out lag |
| Edge/media | cache hit, origin requests, transfer, storage, abusive/bot traffic |
| Reliability | availability, incidents, achieved RPO/RTO, last restore/failover drill |
| Cost | actual/forecast by provider, cost/MAU, cost/order, budget variance |

The outcome must be: keep, tune, resize, add a managed component, run a migration proof, or approve migration. “Move to AWS/GCP because we are growing” is not evidence.

## Immediate 30/60/90-Day Plan

### Next 30 days

- Record actual Neon plan, region, storage and CU-hours; record current Render/Vercel billing plans.
- Add uptime, API p95/error, database connections, outbox age and billing dashboards.
- Establish stable custom hostnames so app releases do not depend on provider URLs.
- Prepare Prisma production migrations and remove production reliance on schema push.
- Measure public and authenticated latency from at least North America, Europe and APAC, then save the region-selection and load-test evidence.

### Days 31-60

- Create paid beta services and a separate Neon project in the selected primary region; use Frankfurt or Singapore instead of Oregon only when the evidence supports it.
- Rehearse database migration, integrity checks and rollback.
- Deploy beta iOS/Console against stable provider-independent hostnames.
- Add object storage and copyright/source metadata for owned/licensed event media.
- Perform a restore drill and 2x beta-load test.

### Days 61-90

- If real payments are approved, split the outbox worker and add shared coordination before the second API instance.
- Test instance restart, database reconnect, WebSocket reconnect, delayed Stripe webhook and worker retry.
- Configure Cloudflare edge protections and prototype signed admission without making edge state inventory-authoritative.
- Produce GCP/AWS calculator proofs only when a hard migration trigger approaches.

## Official Sources

- Render pricing: <https://render.com/pricing>
- Render regions: <https://render.com/docs/regions>
- Render scaling: <https://render.com/docs/scaling>
- Render uptime: <https://render.com/docs/uptime-best-practices>
- Neon pricing: <https://neon.com/pricing>
- Neon region migration: <https://neon.com/docs/import/migrate-from-neon>
- Vercel pricing: <https://vercel.com/pricing>
- Vercel commercial-use boundary: <https://vercel.com/docs/limits/fair-use-guidelines>
- Cloudflare Workers pricing: <https://developers.cloudflare.com/workers/platform/pricing/>
- Cloudflare R2 pricing: <https://developers.cloudflare.com/r2/pricing/>
- Cloudflare Waiting Room: <https://developers.cloudflare.com/waiting-room/>
- AWS Fargate pricing: <https://aws.amazon.com/fargate/pricing/>
- AWS RDS PostgreSQL pricing: <https://aws.amazon.com/rds/postgresql/pricing/>
- Google Cloud Run pricing: <https://cloud.google.com/run/pricing>
- Google Cloud Run regions: <https://cloud.google.com/run/docs/locations>
- Google Cloud SQL pricing: <https://cloud.google.com/sql/pricing/>
