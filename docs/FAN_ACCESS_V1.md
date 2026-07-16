# Fan Access V1

Status: implementation contract for the V4 consumer app, API, and FanPass Console.
Date: 2026-07-16
Selected visual: `docs/ux/concepts/fan-access/fan-access-v1-selected.png`

## Product Promise

Fan Access rewards verified support without turning fandom into repetitive work. A campaign must tell a fan, before they participate:

- what the benefit is;
- how many benefits exist;
- how qualification works;
- how recipients are selected;
- when the campaign closes;
- what evidence is used;
- how to request review or appeal.

Fan Access is not an airdrop, a speculative token program, or a global loyalty leaderboard.

## V1 User Journey

1. A fan opens an active campaign from Explore or an event detail page.
2. The reward contract appears before the task list.
3. The fan sees no more than three organizer-defined actions.
4. Automatic actions are verified from FanPass-owned ticket, order, follow, or check-in records. Manual proof is used only when an automatic source does not exist.
5. Reaching the published threshold makes the fan eligible. It does not guarantee a scarce reward unless the campaign explicitly uses guaranteed allocation.
6. The allocation runs once according to the published method.
7. A selected fan receives one entitlement and claims it to one destination.
8. Rejected submissions and risk holds expose a reason code and an appeal path.

## Canonical Campaign Rules

Each campaign owns one reward contract:

| Field                   | V1 rule                                                       |
| ----------------------- | ------------------------------------------------------------- |
| Reward supply           | Required and immutable after allocation starts.               |
| Qualification threshold | Required; must be reachable without completing every task.    |
| Allocation              | `EQUAL_DRAW` or `GUARANTEED`. No hidden ranking.              |
| Active tasks            | Maximum three user-visible tasks.                             |
| Social tasks            | Optional, one-time, and capped at 10% of the available score. |
| Automatic proof         | Preferred for tickets, orders, follows, and check-ins.        |
| Manual proof            | Requires a review SLA, reason code, and appeal path.          |
| Entitlement             | Unique per campaign and FanPass user.                         |
| Claim destination       | One destination per entitlement.                              |

The initial Aurora fixture uses:

- reward: `Aurora Encore Priority Presale`;
- supply: `240`;
- threshold: `40` points;
- allocation: `EQUAL_DRAW`;
- tasks: follow `+5`, hold a verified Aurora ticket `+35`, attend live `+30` optional;
- one profile and one claim per campaign.

## Score, Risk, And Eligibility

These concepts are separate:

- `fanScore`: user-visible verified contribution. It never includes a hidden risk deduction.
- `riskDecision`: private control-plane result: `ALLOW`, `REVIEW`, or `BLOCK`.
- `eligibilityStatus`: published campaign decision: `NOT_ELIGIBLE`, `ELIGIBLE`, `SELECTED`, `CLAIMED`, `EXPIRED`, or `REVOKED`.

The API may combine `fanScore >= qualificationPoints` with `riskDecision` to determine whether allocation can proceed, but it must not silently lower the visible score. A held decision must return a stable reason code to authorized Console users and a safe, non-sensitive explanation to the fan.

## Wallet Policy

The FanPass account represents the person. Wallets are linked evidence and claim destinations.

- A user may link a limited number of ownership-verified wallets under a private risk policy.
- Only a bounded subset of linked wallets may contribute new earning evidence within the risk window.
- All linked-wallet activity aggregates to one FanPass profile.
- Wallet count never multiplies points, draw entries, or entitlements.
- One campaign has one claim destination per user.
- An unlink does not erase historical linkage; replacement uses a cooldown.
- Activity beyond private policy thresholds triggers step-up verification or review, not an automatic ban.
- The ordinary V1 flow does not require KYC or proof-of-personhood.
- High-value or high-risk claims may request privacy-preserving step-up verification.

These numeric thresholds are private control-plane policy. Public campaign APIs, consumer UI, and organizer-facing product copy must describe fairness and one-profile/one-claim semantics without publishing wallet counts; authorized backend enforcement and audit evidence remain authoritative.

V1 must not add a public wallet-link mutation until server-side signature verification, replay protection, address normalization, cooldown, and audit behavior are implemented together.

## Anti-Abuse Layers

Low-friction controls apply to every campaign:

- authenticated FanPass account;
- signed wallet ownership where a wallet is used;
- idempotent task submission;
- one approved score event per task and user;
- rate and velocity checks;
- durable device/account/wallet linkage history;
- unique entitlement per campaign and user.

Higher-value rewards may add ticket/payment/check-in evidence, account age, funding-cluster review, or privacy-preserving proof-of-human. Shared household networks and legitimate multi-wallet use must not be blocked by a single signal. Risk decisions require an audit trail and appeal support.

## Web3 Boundary

Routine points, task state, allocation, and fraud controls remain backend-authoritative and off-chain. Chain use is limited to durable milestones where portability or independent verification creates user value:

- attendance credentials;
- selected access credentials;
- claimed organizer benefits.

Credentials should be non-transferable. Gas should be sponsored, wallet creation should be embedded, and the consumer UI should not require chain switching, gas management, seed phrases, token prices, or marketplace language.

FanPass must not launch a tradable Fan Token in V1.

## Backend Contract

The durable model is:

```text
Event
└── FanCampaign
    ├── FanTask (maximum three visible)
    │   └── FanTaskSubmission
    └── FanEntitlement (unique campaign + user)
```

Required behavior:

- public campaign and task reads return no user identifiers, proofs, wallet addresses, risk signals, or private allocation material;
- fan progress is restricted to the authenticated fan;
- organizers can only manage campaigns owned by their organizer scope;
- submission decisions are idempotent, audited, and immutable after allocation without an explicit admin correction event;
- allocation and claim operations use database uniqueness constraints;
- proofs are never included in public or organizer-list responses unless the viewer is authorized and the field is needed for review.

Compatibility endpoints may continue to return `score` while also returning `fanScore`, `qualificationPoints`, and `pointsToQualify` during migration.

## Console Workflow

The event-scoped Console contains:

1. `Campaign contract`: status, reward, supply, threshold, allocation, start, and close.
2. `Ways to qualify`: up to three ordered tasks with points, optional state, and verification method.
3. `Review queue`: pending manual submissions with approve/reject, required reason, audit evidence, and retry-safe mutations.
4. `Eligibility`: eligible, held, selected, claimed, and remaining inventory counts.
5. `Appeals`: reason-coded cases and final resolution.

Campaign editing and review are operational mutations. The UI must not display a working control until the API authorization, validation, idempotency, and audit contract exists.

## iOS Contract

The selected V4 screen uses this order:

1. compact event artwork and reward title;
2. supply, threshold, allocation, and close date;
3. neutral `Ways to qualify` copy;
4. one grouped list of at most three task rows;
5. visible eligibility progress and points remaining;
6. one context-aware primary action;
7. selection explanation, one-profile/one-entry fairness, and appeal link.

Copy must not use `real fan`, `prove loyalty`, `complete all tasks`, streak pressure, referral pressure, or guaranteed-win language.

## Release Gates

Before enabling real rewards:

- PostgreSQL migration and rollback are rehearsed on staging.
- Campaign, review, allocation, and claim authorization tests pass.
- Duplicate task, entitlement, and claim attempts are rejected atomically.
- Public response privacy checks cover campaign and score responses.
- Console review mutations are origin-protected and audited.
- iOS shows loading, empty, error, in-review, eligible, selected, and expired states.
- Allocation terms and promotion rules receive jurisdiction-specific legal review.
- On-chain issuance, if enabled, is optional to the core claim and does not expose private user data.
