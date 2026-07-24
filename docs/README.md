# FanPass Documentation

This directory contains current product contracts and machine-checked evidence. It is intentionally smaller than the historical document set; removed plans and append-only logs remain available in Git history before the 2026-07-12 documentation cleanup.

## Read First

1. `CODEX_HANDOFF.md` - current repository, deployment, simulator, and priority state.
2. `DEVELOPMENT_TASKS.md` - open and completed engineering work.
3. `BETA_ROADMAP.md` - product boundaries and release direction.
4. `QA_CHECKLIST.md` - required verification and security gates.
5. `design.md` - staged V5/V4 UI contract.

`NEW_CHAT_PROMPT.md` is a concise resume prompt generated from the Handoff. It is not the primary source of truth.

## Core Contracts

| Document                                            | Purpose                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `ARCHITECTURE.md`                                   | Product surfaces and system ownership boundaries.                          |
| `FAN_ACCESS_V1.md`                                  | Fan Access campaign, score, wallet, anti-abuse, Console, and iOS contract. |
| `MAIN_APP_PRODUCT_AUDIT.md`                         | Living consumer release audit, severity backlog, evidence, and gates.      |
| `DEPLOYMENT_ENVIRONMENTS.md`                        | Local, staging, and production-like environment rules.                     |
| `INFRASTRUCTURE_SCALING_PLAN.md`                    | Global regions, cost stages, upgrade triggers, and AWS/GCP migration plan. |
| `PROVIDER_COST_FEASIBILITY.md`                      | Stripe, Privy, and provider constraints.                                   |
| `IOS_DISTRIBUTION_PLAN.md`                          | Signing, TestFlight, and release boundaries.                               |
| `PROTOTYPE_SHORTCUT_REGISTER.md`                    | Explicitly contained prototype-only behavior.                              |
| `technical/FanPass_High_Demand_Onsale_Design_V4.md` | Queue, hold, inventory, and fairness design.                               |
| `technical/FanPass_Orderbook_Design_V4.md`          | Controlled resale orderbook behavior.                                      |
| `technical/FanPass_QR_NFC_Verification_Plan_V4.md`  | Backend-authoritative entry and replay rules.                              |
| `technical/FanPass_Chain_Custody_Runbook_V4.md`     | Chain signer/custody operations.                                           |

## Commercial Vibe Coding System

| Document | Purpose |
| --- | --- |
| `vibe-coding/README.md` | Entry point, usage model, evidence layers, and maintenance rules. |
| `vibe-coding/FANPASS_JOURNEY.md` | Continuously updated FanPass progress, experiments, problems, decisions, and current next steps. |
| `vibe-coding/COMMERCIAL_PROJECT_PLAYBOOK.md` | Reusable stage gates from opportunity through paid pilot and scale. |
| `vibe-coding/TEMPLATES.md` | Copyable project, task, decision, incident, release, content, cost, and review templates. |

The Journey is the continuously updated project-learning record; `CODEX_HANDOFF.md` remains the concise current-state snapshot. Neither document claims that the in-progress product has completed commercial launch, and neither should duplicate a raw chat transcript.

## Evidence Contracts

Uppercase files ending in `_EVIDENCE.md`, the privacy matrix, dependency logs, and Alpha security/runbook files are retained because repository security scripts validate their paths and required markers. Do not merge or rename them without updating and testing the corresponding script under `scripts/`.

These files are evidence contracts, not claims that production readiness is complete. A gate closes only when its validator passes with matching saved evidence.

## Design Status

- Active mixed baseline: `docs/design.md`.
- V5 Home, Explore, and Event Detail: `FanPass_VI_Redesign_V5/` plus the isolated `FPV5*` Swift tokens/components.
- V4 remains active on unmigrated Market, Tickets, Account, Checkout, Fan Access, and Ops screens.
- The owner approved staged V5 implementation on 2026-07-25; full production-baseline replacement and public submission are not yet approved.

## Archived Coursework

The completed school Web, Arduino/EP8280 turnstile, bridge, enclosure source, and school handoff live under `archive/school-project/`. Generated `node_modules`, `dist`, local school data, CAD outputs, and `.DS_Store` are intentionally excluded.

Archived hardware is not an active app dependency or release gate unless the owner explicitly reopens it.

## Maintenance Rules

- Keep `CODEX_HANDOFF.md` as a current snapshot, not an append-only diary.
- Update existing contracts instead of creating a new Markdown file for each work pass.
- Add a new document only when it has a distinct owner, lifecycle, or machine validator.
- Delete superseded planning notes after their durable decisions are merged into a current contract.
- Preserve historical detail through Git rather than duplicating it across active docs.
