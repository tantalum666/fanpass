# FanPass Report

Source: `/Users/tantalum/Downloads/票务平台想法.docx`

This Markdown file is the durable handoff copy of the Word document. It replaces the earlier PPT-derived summary and should be treated as the richer product/proposal source.

## 1. Project Positioning

Recommended project name:

**FanPass: A Mobile-first Blockchain-based Fair Ticketing and Verified Resale Platform**

Chinese name:

**FanPass：面向粉丝的区块链票务发行、转让与验票平台**

One-line positioning:

FanPass is a mobile-first ticketing platform that supports official organizer ticket sales, fan-task-based fair-access rights, NFT/SBT ticket authenticity and provenance, controlled secondary transfer, transparent price charts, and onsite verification. The goal is to reduce fake tickets, opaque resale, excessive premiums, and information asymmetry after fans fail to buy primary-sale tickets.

The product should not be framed as a platform that helps scalpers list tickets. It should be framed as an **officially authorized, fan-friendly, regulated, transparent ticket lifecycle platform**.

## 2. Industry Problem

The problem is broader than slow ticket purchasing. Popular concerts and live events combine several structural issues:

- Demand exceeds supply. Venue capacity is fixed while demand may come from a whole region.
- Tickets are split before public sale into public sale, member presale, card/travel-platform presale, sponsor allocation, VIP packages, internal tickets, media tickets, and work tickets.
- Bots and professional purchasing teams push ordinary fans out of the queue.
- Strong real-name ticketing can reduce scalping but also makes normal transfer and refund harder.
- Secondary marketplaces solve “can I buy a ticket?” but often fail to solve fairness, price transparency, delivery certainty, source transparency, and trust.

The proposal should use neutral language for existing secondary platforms: reseller-driven secondary supply can create price premiums, authenticity risk, delivery uncertainty, opaque pricing, and weak consumer trust.

## 3. Business Model and Revenue Logic

Traditional ticketing roles:

| Role | Revenue | Problem |
| --- | --- | --- |
| Organizer / promoter | Box office, VIP packages, sponsorship, merchandise, advertising, livestream/content | Wants revenue growth, but aggressive dynamic pricing can harm fan experience |
| Primary ticketing platform | Service fees, order processing fees, payment share, SaaS/system services, data/marketing services | Users often see fees as opaque |
| Secondary ticketing platform | Buyer/seller commissions, guarantee fees, ads, merchant listings | May encourage premium resale and hoarding |
| Reseller / scalper | Buy scarce tickets low and resell high | Depends on information gap, speed, bots, multi-accounting, or special supply |
| Venue / vertically integrated operator | Ticketing, event operation, venue revenue, sponsorship, food/beverage, ads | High concentration reduces consumer choice |

Recommended FanPass monetization:

| Revenue Item | Suggested Model |
| --- | --- |
| Primary ticketing service fee | Small fixed or percentage service fee, such as 1-3% |
| Secondary transfer fee | Transparent buyer/seller total fee, such as 3-8% |
| Organizer/artist resale royalty | Portion of secondary-market premium returned to organizer or artist |
| SaaS tools | Event creation, verification, fan management, reporting for smaller organizers |
| Data analytics | Price trends, heat, transfer rate, entry rate, fan segments |
| White-label system | Branded ticketing for schools, clubs, and small festivals |
| Payment and settlement | Stripe Connect-style marketplace payments and split payouts in test mode for FYP/Beta |

## 4. Preserve and Adjust the Original Idea

Strong original ideas to preserve:

- NFT/SBT tickets.
- Traceable transfer lifecycle.
- Orderbook-style transparent resale.
- Fan tasks and fan-score-based access rights.

Important adjustment:

Do not copy stock-market or DEX orderbooks directly. Tickets are not fully fungible assets. A ticket has event, date, category, section, row, seat, real-name status, transferability, and VIP/package properties.

Recommended market hierarchy:

| Level | Example |
| --- | --- |
| Event | The Weeknd Hong Kong 2026 |
| Date | 2026-10-30 / 2026-10-31 |
| Category | CAT 1 / CAT 2 / Standing / VIP |
| Seat | Section, row, seat |
| Ticket | Individual NFT or ERC-1155 token instance |

Orderbook groups should be based on ticket type or zone, for example:

- `THEWEEKND-HK-2026-10-30-CAT2`
- `THEWEEKND-HK-2026-10-31-STANDING`
- `SCHOOL-CONCERT-2026-VIP`

User-facing market data should avoid excessive financial jargon and show:

- Current floor price.
- Highest bid.
- Latest trade.
- Face value vs market premium.
- Available quantity.
- Volume.
- Price chart.
- Price-range heatmap.
- Source labels: official ticket, fan transfer ticket, certified reseller ticket.

## 5. Controlled Transfer Model

FanPass should not be a free scalper market. It should be a controlled official transfer marketplace.

| Role | Permissions |
| --- | --- |
| Organizer | Publish primary tickets, set transfer rules, set resale cap, review data |
| Fan | Buy tickets, complete tasks, earn fair-access rights, transfer idle tickets |
| Certified reseller | Trade only under organizer-approved events and price rules |
| Platform admin | Review events, handle disputes, ban abnormal accounts |
| Gate staff | Scan QR/NFC, verify ticket, mark entry |

The core idea is regulated transfer, not unrestricted speculation.

## 6. Reference Projects

### OPEN / onopen.xyz

OPEN is closer to onchain ticketing infrastructure. It provides API-first ticket engine infrastructure for distributing onchain tickets and collectibles. FanPass can learn from the infrastructure/API model but should stay focused on a demonstrable fan-facing marketplace for FYP.

### SI Tickets / Box Office

SI Tickets emphasizes NFT ticketing and fan engagement around pre-event, onsite, and post-event benefits. FanPass can learn from post-event engagement: a ticket can also become a collectible, benefit credential, or merchandise claim.

### XP

XP is a Solana-based ticketing marketplace that hides crypto complexity and lets users register by phone and pay by card. This supports a core FanPass UX principle: Web3 should stay behind the scenes.

### TIX

TIX is a Base-based blockchain ticketing project with NFT tickets, anti-fraud, transparent fees, smart-contract price rules, fiat/crypto payment, and post-event rewards. FanPass can reference its MVP scope while differentiating through orderbook transparency, fan-task whitelist, and resale control.

### TicketMe

TicketMe is a Japanese NFT ticketing platform emphasizing identity verification, resale control, and creator return from high-price resale. It is a strong theoretical reference for “reasonable resale with controls,” not total resale prohibition.

FanPass differentiation:

| Existing Type | Their Focus | FanPass Difference |
| --- | --- | --- |
| Traditional primary platform | Official sales, queueing, real-name checks, entry verification | Adds transparent secondary transfer and price data |
| Traditional secondary platform | Ticket availability and transaction guarantee | Adds provenance, source labels, transfer rules, and resale caps |
| OPEN | Ticketing infrastructure/API | Builds a concrete fan-facing app and visual market |
| SI Tickets | NFT ticket + fan engagement | Adds orderbook and fair-access mechanism |
| XP | Blockchain secondary marketplace | Adds organizer rules, SBT, and fan score |
| TicketMe | NFT + identity + resale control | Adapts controlled mobile MVP for Hong Kong/Asia event scenarios |

## 7. Product Modules

### A. User Login and Hidden Wallet

Privy can be used for login and embedded wallets. The normal user journey should be:

- Email, phone, or Google login.
- System creates embedded wallet automatically.
- User sees “my tickets,” not “my NFT.”
- User pays with Stripe, card, or Apple Pay.
- Chain transactions are handled by backend or gas sponsorship.

The product should be usable by people who do not understand wallets, private keys, or gas fees.

### B. Event and Ticket Issuance

Organizer can configure:

- Event name, venue, date.
- Ticket types and prices.
- Seating map or zones.
- Supply.
- Real-name requirement.
- Transfer permission.
- Maximum resale price.
- Transfer count limit.
- Official buyback option.
- Entry method: dynamic QR, NFC, or manual list.

Ticket categories:

| Ticket Type | Technical Form | Use Case |
| --- | --- | --- |
| Transferable ticket | NFT / ERC-721 or ERC-1155 | Normal concert/festival ticket |
| Non-transferable ticket | SBT / EIP-5192-style locked NFT | Real-name ticket, student ticket, lottery right |
| Purchase entitlement | SBT or off-chain entitlement | Whitelist, original-price purchase right, discount |

### C. Fan Access Program

The “airdrop / NFT whitelist” idea should be reframed positively as a fan access program.

Possible tasks:

- Follow artist or organizer account.
- Share event link.
- Invite friend registration.
- Complete fan quiz.
- Join offline check-in.
- Buy official merchandise.
- Maintain good past entry record.
- Avoid abnormal resale behavior.
- Join community vote.

Rewards should be:

- Original-price purchase lottery eligibility.
- Priority queue access.
- Discount.
- SBT fan badge.
- Official waitlist ranking boost.
- Priority matching for low-price transfer tickets.

Avoid direct “free ticket” rewards because they increase abuse risk.

### D. Transparent Secondary Orderbook

Core flow:

- Seller lists an ask: willing to sell CAT2 for HKD 1,200.
- Buyer lists a bid: willing to buy CAT2 for HKD 1,000.
- System matches orders.
- After trade, NFT ownership transfers and funds settle through escrow/Stripe/smart contract.
- Ticket status becomes `transferred`.
- Price chart updates.

Suggested market data:

- Face value.
- Floor price.
- Latest trade.
- Premium rate.
- Bid-ask spread.
- Volume.
- Remaining supply.
- Official vs secondary ticket ratio.
- Abnormal price alert.

Implementation recommendation: use **off-chain orderbook + on-chain settlement** for better performance, lower fees, and easier risk control/refund/dispute handling.

### E. Entry Verification

MVP should use dynamic QR code plus backend status verification.

NFC should be treated carefully:

- iOS PWA/Web NFC is not reliable enough to promise.
- iOS NFC should use native Core NFC.
- Android PWA NFC can be explored as an extension.

Recommended stages:

| Stage | Verification |
| --- | --- |
| MVP | Dynamic QR code + backend verification |
| Extension | Android PWA NFC tag reading |
| Advanced | Native iOS/Android scanner app + NFC |
| Commercial | Venue turnstile, handheld scanner, Apple Wallet pass |

Do not promise “iOS PWA direct NFC verification” in the proposal.

## 8. MVP Scope

MVP objective:

Build a mobile-first fair ticketing prototype that allows event organizers to issue blockchain-backed tickets, fans to earn fair-access purchase rights, users to resell tickets under organizer-defined rules, and gate staff to verify tickets through a secure check-in interface.

Required MVP modules:

| Module | Function |
| --- | --- |
| User system | Email/phone login; roles: fan, organizer, admin, gate staff |
| Event management | Organizer creates event, ticket type, price, supply |
| NFT/SBT tickets | Transferable NFT ticket and non-transferable SBT ticket |
| Fan tasks | Complete tasks for fan score / whitelist entitlement |
| Primary purchase | User buys or simulates buying a ticket |
| Secondary listing | Seller lists, buyer orders, price chart |
| Transfer rules | Price cap, transfer count, real-name status |
| Verification | Dynamic QR, scan, mark redeemed |
| Admin dashboard | Orders, ticket status, abnormal trades |
| Data visualization | Floor price, latest trade, volume, premium rate |

Out of MVP:

- Real large-concert integration.
- Real HK Ticketing / Trip.com API.
- Real venue turnstile.
- Production payment settlement.
- Full KYC.
- Full NFC native app for production.
- Real scalper marketplace.

Use Stripe test mode, blockchain testnet, and simulated event data for school/FYP safety.

## 9. Recommended Technical Architecture

Frontend:

- Next.js / React.
- PWA-style mobile-first UI.
- Tailwind CSS / shadcn/ui.
- Recharts or ECharts for price charts, volume, and orderbook depth.
- QR scanner library for verification UI.

Backend:

- Node.js + NestJS or Express.
- PostgreSQL + Prisma.
- Redis for queueing, rate limits, orderbook cache.
- WebSocket for realtime prices/orderbook.
- S3/Cloudinary-style storage for posters and ticket images.
- Admin dashboard.

Web3:

- Solidity + Hardhat.
- Base Sepolia / Polygon Amoy / Sepolia testnet.
- ERC-721 or ERC-1155 for transferable tickets.
- EIP-5192-style locked NFT for non-transferable tickets / SBT.

Contract functions:

- Mint ticket.
- Transfer ticket.
- Lock/unlock transfer.
- Mark redeemed.
- Validate price cap.
- Organizer royalty.
- Ownership verification.

Login and payment:

- Privy for login and embedded wallet.
- Stripe Checkout or PaymentSheet for primary purchase.
- Stripe Connect for future marketplace split payouts in test mode.
- Optional crypto/USDC payment only as a demo extension.

Verification:

- MVP: dynamic QR + backend verification.
- Extension: Android NFC PWA.
- Advanced: native app + NFC reader.

## 10. Core Database Tables

| Table | Key Fields |
| --- | --- |
| `users` | `id`, `name`, `email`, `phone`, `role`, `privyId`, `walletAddress` |
| `organizers` | `id`, `userId`, `companyName`, `verificationStatus` |
| `events` | `id`, `organizerId`, `title`, `venue`, `date`, `status` |
| `ticket_types` | `id`, `eventId`, `name`, `faceValue`, `supply`, `transferable`, `resaleCap` |
| `tickets` | `id`, `tokenId`, `ownerId`, `eventId`, `ticketTypeId`, `seatInfo`, `status` |
| `orders` | `id`, `eventId`, `ticketTypeId`, `side`, `price`, `quantity`, `status` |
| `trades` | `id`, `buyOrderId`, `sellOrderId`, `ticketId`, `price`, `fee` |
| `fan_tasks` | `id`, `eventId`, `title`, `points`, `verificationMethod` |
| `fan_task_submissions` | `id`, `userId`, `taskId`, `status` |
| `fan_scores` | `id`, `userId`, `eventId`, `score` |
| `checkins` | `id`, `ticketId`, `gateStaffId`, `checkedInAt`, `result` |
| `audit_logs` | `id`, `actorId`, `action`, `metadata`, `createdAt` |

## 11. Core Innovation Points

1. **Blockchain-backed ticket authenticity**: each ticket has a unique token ID, ownership, transfer history, and entry status.
2. **Controlled resale marketplace**: organizer can set resale cap, transfer count, real-name requirement, and royalty.
3. **Orderbook-style price transparency**: users can see bid, ask, trade history, premium, and price trend.
4. **Fan access program**: fans earn original-price purchase or discount rights through positive engagement.
5. **Web2-friendly Web3 UX**: Privy, Stripe, and mobile-first UI hide wallet/private-key/gas complexity.

## 12. Risks and Mitigations

| Risk | Explanation | Mitigation |
| --- | --- | --- |
| Legal risk | Different jurisdictions regulate resale and real-name tickets differently | MVP uses school/simulated events; commercial version requires organizer authorization |
| NFT cannot create more seats | NFT solves authenticity/provenance, not supply shortage | Add fan score, lottery, purchase limits, anti-bot controls |
| Task system abuse | Bots can farm sharing/tasks | Limit tasks, add phone/device/behavior risk controls |
| Web3 UX friction | Users do not understand wallets/gas | Privy embedded wallet + fiat payment |
| iOS NFC limitation | PWA NFC is unreliable on iOS | MVP uses QR; NFC is native/extension |
| Privacy | Real-name data plus public chain can leak identity | Store only token/status hash on-chain; personal data stays backend-side |
| Payment disputes | Refunds, transfer disputes, failed entry | Escrow, settle after check-in, platform arbitration |
| Price speculation | Orderbook can encourage trading behavior | Resale cap, cooldown, fan-only listing |

## 13. Proposal Structure

Recommended FYP proposal sections:

### Abstract

Summarize popular-event ticketing problems: hard-to-buy tickets, high-premium resale, fake tickets, refund/transfer difficulty, and opaque price data. Present FanPass as a mobile-first blockchain ticketing platform using NFT/SBT, orderbook, fan task score, controlled resale, and dynamic QR verification.

### Introduction

Introduce the live-event ticketing industry, primary market, secondary market, Hong Kong/Asia concert purchasing pain points, and Web3 potential for ticket authenticity and transfer control.

### The Problem

Cover:

- Ordinary fans cannot get tickets.
- Secondary market pricing is opaque.
- Bots and scalpers create unfairness.
- Strong real-name policies can make legitimate transfer harder.
- Fake tickets and duplicate sales create trust risk.
- Organizers cannot benefit from or control secondary-market activity.
- Existing platforms do not provide enough transparency to ordinary users.

### Proposed Solution

FanPass modules:

- Organizer event creation.
- NFT/SBT ticket issuance.
- Fan task and whitelist system.
- Transparent resale orderbook.
- Price cap and transfer rule engine.
- Payment integration.
- QR/NFC verification.
- Analytics dashboard.

### Requirements

Functional:

- Registration/login.
- Create events.
- Issue tickets.
- Buy tickets.
- List orders.
- Match orders.
- Transfer ownership.
- Verify entry.
- Show data charts.
- Admin management.

Non-functional:

- Usability: usable without Web3 knowledge.
- Performance: fast orderbook updates.
- Security: anti-replay, anti-fraud, abnormal transaction controls.
- Reliability: fallback for entry verification.
- Privacy: personal data not directly on-chain.
- Scalability: multiple events and ticket types.
- Compatibility: mobile-first and PWA-friendly.

### Software Process Model

Use Agile / Iterative Development because the product has many modules and can be split into 1-2 week sprints.

### Project Plan

| Period | Work |
| --- | --- |
| Week 1-2 | Requirement analysis, competitor research, system design |
| Week 3-4 | UI/UX, database, backend foundation |
| Week 5-6 | Event creation, ticket type management, user system |
| Week 7-8 | NFT/SBT contracts, mint ticket |
| Week 9-10 | Orderbook, listing, matching, price charts |
| Week 11 | Fan task / whitelist |
| Week 12 | QR verification and redeemed state |
| Week 13 | Admin dashboard and testing |
| Week 14 | Documentation, demo video, final report |

### Deliverables

- Proposal.
- System design document.
- UI prototype.
- Web/PWA application.
- Backend API.
- Smart contracts.
- Database schema.
- Testing report.
- Demo video.
- Final report.
- Presentation slides.

## 14. Final Optimized Project Description

English:

FanPass is a mobile-first blockchain-based ticketing and verified resale platform designed to improve fairness, transparency, and trust in live event ticketing. The system allows organizers to issue NFT or SBT tickets, define resale rules, reward real fans with fair-access purchase rights, and verify tickets at the venue through dynamic QR codes. A transparent orderbook-style marketplace displays bid/ask prices, transaction history, and resale premiums, allowing fans to make informed decisions while helping organizers monitor and control secondary-market activity.

Chinese:

FanPass 是一个移动端优先的区块链票务发行与认证转售平台，目标是提升演出票务市场的公平性、透明度和可信度。主办方可以发行 NFT 或 SBT 门票，并设置转售规则；粉丝可以通过任务和签到获得优先购票或折扣资格；二级转让通过 orderbook 形式展示价格、挂单、成交记录和溢价率；现场通过动态 QR 或扩展 NFC 方案验票入场。
