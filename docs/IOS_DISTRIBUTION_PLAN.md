# FanPass iOS Distribution Plan

Date: 2026-05-29

## Scope

This plan covers native iOS distribution for two separate apps:

- `FanPass` - consumer app for fans.
- `FanPass Ops` - gate staff and onsite operations app.

`FanPass Console` remains web-first and is not distributed through the App Store.

## Current Local Targets

| App         | Current bundle id | Current scheme | Role                                           |
| ----------- | ----------------- | -------------- | ---------------------------------------------- |
| FanPass     | `com.fanpass.app` | `FanPass`      | Consumer discovery, wallet, market, fan access |
| FanPass Ops | `com.fanpass.ops` | `FanPassOps`   | Gate scan, redemption, NFC prototype           |

The current bundle ids are acceptable for local development. Before the first App Store Connect upload, decide whether to keep them or switch to longer-lived ids owned by the final Apple Developer account, because bundle ids become difficult to change after distribution history exists.

## Apple Distribution Facts To Respect

- Apple documents TestFlight as the beta distribution path where testers install builds through the TestFlight app and provide feedback.
- Apple documents App Store Connect distribution as requiring Apple Developer Program membership for registered-device, TestFlight, or App Store distribution.
- Apple documents Core NFC as reading NDEF tags and requiring the NFC tag-reading entitlement.

Official references:

- [TestFlight - Apple Developer](https://developer.apple.com/testflight/)
- [Distributing your app for beta testing and releases - Apple Developer Documentation](https://developer.apple.com/documentation/Xcode/distributing-your-app-for-beta-testing-and-releases)
- [Core NFC - Apple Developer Documentation](https://developer.apple.com/documentation/CoreNFC)
- [App Store Connect API CapabilityType - Apple Developer Documentation](https://developer.apple.com/documentation/appstoreconnectapi/capabilitytype)

## Account And Signing Prerequisites

Required from the founder before real-device/TestFlight distribution:

- Apple Developer Program membership.
- App Store Connect access with permission to create apps, bundle ids, certificates, identifiers, and profiles.
- Team ID for signing.
- Legal entity/app ownership decision for the FanPass brand.
- Final app names, privacy contact email, support URL, and marketing URL placeholders.

Required signing assets:

- Apple Development certificate for local physical-device testing.
- Apple Distribution certificate for TestFlight/App Store uploads.
- App Store provisioning profile for `FanPass`.
- App Store provisioning profile for `FanPass Ops`.
- Development provisioning profiles for physical-device QA.

## Capabilities By App

FanPass:

- No Camera permission.
- No NFC entitlement.
- Push notifications are optional later.
- Associated Domains are optional later for universal links.
- Apple Wallet pass presentation can be added after a signed `.pkpass` backend exists. Near-term Wallet scope is barcode-based signed passes; NFC/tap-to-reader Wallet entry requires separate Apple entitlement/access and should be treated as future venue/enterprise work.
- Near-term entry presentation is a dynamic, short-lived QR displayed by the fan app, not a user-carried NFC/RFID tag.

FanPass Ops:

- Camera permission for QR scanning.
- NFC Tag Reading capability for Core NFC NDEF scanning as an internal fixture/prototype path.
- No consumer wallet, market, or organizer controls.
- Device testing is required because simulator cannot validate camera hardware or NFC reading.

Do not enable broad capabilities by default. Add each capability only when the product surface actually needs it.

## Environment Strategy

Use separate build configurations or `.xcconfig` files before TestFlight:

| Environment     | API base URL                                                      | Data/payment mode                | Intended audience         |
| --------------- | ----------------------------------------------------------------- | -------------------------------- | ------------------------- |
| Local Debug     | `Config/Local.xcconfig` -> `http://localhost:4000`                | local demo/mock                  | Simulator and development |
| Staging Debug   | `Config/Staging.xcconfig` -> replace with HTTPS staging API       | Stripe test mode, Privy test app | Founder/internal QA       |
| TestFlight Beta | `Config/Beta.xcconfig` -> replace with HTTPS beta API             | Stripe test mode only            | Closed external testers   |
| Production      | `Config/Production.xcconfig` -> replace with HTTPS production API | Production-grade providers only  | Future public launch      |

Local HTTP must not ship in TestFlight. Both apps need an environment-aware API client before external testers receive builds.

## TestFlight Rollout Stages

1. Physical-device internal install
   - Goal: prove signing, app launch, local navigation, QR camera, NFC availability, and API connectivity.
   - Audience: founder/developer devices only.
   - Exit: both apps install outside simulator; Ops camera and NFC permission prompts behave correctly.

2. Internal TestFlight
   - Goal: validate App Store Connect upload, crash reporting, TestFlight installation, and role separation.
   - Audience: internal App Store Connect testers.
   - Exit: FanPass and FanPass Ops install as separate apps; FanPass has no staff controls; Ops has no consumer market/wallet flows.

3. Closed external TestFlight
   - Goal: small real-user rehearsal without real money or real event admission.
   - Audience: invited fan, gate staff, and organizer testers.
   - Exit: happy path works with test data; no real PII beyond tester accounts; Stripe remains test mode; all incidents logged.

4. Pilot readiness review
   - Goal: decide whether the product is ready for a venue or organizer pilot.
   - Exit: security review, provider validation, support process, incident response, privacy policy, and legal terms are ready.

## Required QA Before External Testers

FanPass:

- Guest opens browsable home, not login wall.
- Auth appears only at private actions.
- No staff scanner, admin, inventory, audit, or gate language.
- Wallet shows ticket, status, ownership history, and entry code only after auth.
- Marketplace uses controlled resale rules and clear price context.

FanPass Ops:

- Gate staff can sign in and only access assigned event/gate.
- QR scan accepts first valid dynamic fan-phone payload and rejects replay.
- NFC scan reads a supported NDEF fixture tag into the same redemption path for internal validation only; users are not expected to carry NFC/RFID tags for admission.
- Unsupported NFC devices show a clear fallback.
- Accepted/rejected counts update.
- Paste fallback is hidden or debug-gated before external testers unless explicitly risk-accepted.
- Wallet payload copy and barcode JSON copy remain debug-gated payload copy/paste helpers for local simulator QA only.

Shared:

- API base URL is HTTPS and staging-specific.
- Demo auth is disabled in public/staging-like runtimes.
- Privy public app/client IDs remain injected outside source control, and `FanPassEnvironment` keeps a Privy public-config secret guard so secret-like values are ignored rather than treated as app configuration.
- Stripe PaymentSheet remains test-mode only for current Beta: checked-in iOS configs stay free of Stripe publishable keys, and the `FanPassEnvironment` runtime accessor keeps a test publishable-key runtime guard that accepts only `pk_test_` values supplied outside source control.
- Runtime security checks pass against deployed staging.
- Privacy-scoped responses and redaction are enabled.
- `npm run security:ios-distribution-boundaries` passes, proving the FanPass target has no Camera/NFC permissions, FanPass Ops owns Camera/NFC capability, release API configs stay HTTPS-only and secret-free, Privy public-config secret guard stays enforced, and Apple Wallet stays a signed `.pkpass` blocker rather than a fake local pass flow.
- Saved real-device or TestFlight build evidence passes `npm run security:ios-staging-build:evidence -- <saved-json-output>`, proving both apps used real HTTPS staging/beta API URLs, signed builds, physical-device or TestFlight install evidence, debug helper removal, role separation, the current iOS distribution/config implementation SHA-256 snapshot, deployment/cloud credential absence, CI secret masking command redaction, and redaction.

## Beta Blockers

- Apple Developer account access is now available as of 2026-06-10, but local signing assets are not configured yet. `security find-identity -v -p codesigning` returned zero valid code-signing identities on the local machine.
- Environment-specific iOS API configuration is not implemented yet.
- `FanPass Ops` NFC prototype has not been tested on a physical iPhone with an NDEF tag.
- Apple Wallet `.pkpass` signing is not implemented.
- NFC/contactless Apple Wallet ticket presentation is not in current scope. It requires special Apple entitlement/access, compatible reader protocol, and likely organization-level Apple Developer Program status plus Apple approval/agreements; it is different from standard QR/barcode `.pkpass` support.
- Privy Swift SDK login is wired locally for FanPass and FanPass Ops through placeholder public app/client IDs only; real dashboard evidence and non-placeholder staging/beta app configuration are still open.
- Real Privy mobile app configuration evidence is not saved yet. Future evidence must pass `npm run security:privy-mobile-app-config:evidence -- <saved-json-output>` with deployment credential and CI masking-command redaction proof before non-placeholder app/client IDs are trusted for staging, beta, or TestFlight-style builds.
- Stripe client UI and real Stripe test-mode webhook validation are not complete.
- Deployed staging API/Console URLs do not exist yet.

## Implementation Tasks

- Replace placeholder staging, beta, and production API URLs in the checked-in xcconfig files once real HTTPS endpoints exist.
- Keep `FanPassAPIBaseURL` wired through Info.plist/build settings instead of hardcoding API URLs in Swift views.
- Keep `npm run security:ios-distribution-boundaries:self-test` and `npm run security:ios-distribution-boundaries` wired into `npm run beta:foundation:verify` while replacing placeholders with real HTTPS staging/beta/production endpoints.
- Keep `npm run security:ios-staging-build:evidence:self-test` wired into `npm run beta:foundation:verify` before relying on saved real-device or TestFlight build evidence.
- Completed physical-device QA checklist and audit for FanPass and FanPass Ops: `docs/IOS_PHYSICAL_DEVICE_QA.md` and `npm run security:ios-physical-device-qa`.
- Completed NFC tag fixture format document and audit for supported NDEF payloads: `docs/NFC_NDEF_TAG_FIXTURE.md` and `npm run security:nfc-ndef-fixture`.
- Completed placeholder Apple signing settings in `project.yml` without committing real team IDs, provisioning profile names, certificates, or private keys; `npm run security:ios-distribution-boundaries` now rejects those signing-material markers.
- Completed the Stripe test publishable-key runtime guard in `FanPassEnvironment` and the iOS distribution audit so checked-in configs remain key-free and the current Beta PaymentSheet path only accepts externally supplied `pk_test_` values.
- Completed the Privy public-config secret guard in `FanPassEnvironment` and the iOS distribution audit so public app/client ID slots reject secret-like values, bearer/JWTs, private keys, Stripe keys, webhook secrets, and client secrets.
- Completed local Privy Swift SDK wiring for FanPass and FanPass Ops through `FanPassPrivyAuthProvider`; keep checked-in iOS Privy app/client IDs empty until saved Privy dashboard evidence approves real public values.
- Completed Privy mobile app configuration evidence validator and self-test: `docs/PRIVY_MOBILE_APP_CONFIG_EVIDENCE.md` and `npm run security:privy-mobile-app-config:evidence:self-test`.
- Add Apple Wallet pass signing service after Apple Developer certificates are available.
- For Wallet, build standard signed QR/barcode `.pkpass` first. Do not block TestFlight on NFC Wallet tap-to-reader support.
- Add TestFlight build/archive commands to the runbook after signing is configured.

## 2026-06-10 TestFlight / Physical QR-NFC Push

The owner confirmed Apple Developer account access and redirected priority from web/management concepts to iOS TestFlight plus physical QR/NFC validation.

Current local verification:

- Xcode 26.5 is selected at `/Applications/Xcode.app/Contents/Developer`.
- Xcode schemes exist for `FanPass` and `FanPassOps`.
- `npm run security:ios-distribution-boundaries` passed.
- `npm run security:ios-physical-device-qa` passed.
- `npm run security:nfc-ndef-fixture` passed.
- `FanPass` Debug simulator build passed with `CODE_SIGNING_ALLOWED=NO`.
- `FanPassOps` Debug simulator build passed with `CODE_SIGNING_ALLOWED=NO`.
- `FanPass` Beta generic iOS archive compile passed with `CODE_SIGNING_ALLOWED=NO`; archive metadata correctly shows empty signing identity/team because it was intentionally unsigned.
- `FanPassOps` Beta generic iOS archive compile passed with `CODE_SIGNING_ALLOWED=NO`; archive metadata correctly shows empty signing identity/team because it was intentionally unsigned.
- No physical iPhone was connected when checked with `xcrun devicectl list devices`.

Evidence drafts generated for the next real capture pass:

- iOS/TestFlight draft: `outputs/ios-staging-build/20260610T-testflight-draft.json`
- Physical QR/NFC draft: `outputs/ops-scanner/20260610T-physical-qr-nfc-draft.json`

New local archive helper:

```bash
FANPASS_APPLE_TEAM_ID="<team id>" \
FANPASS_FANPASS_PROVISIONING_PROFILE_SPECIFIER="<FanPass App Store or development profile name>" \
FANPASS_OPS_PROVISIONING_PROFILE_SPECIFIER="<FanPass Ops App Store or development profile name>" \
FANPASS_API_BASE_URL="https://<staging-or-beta-api>" \
FANPASS_PRIVY_APP_ID="<public Privy app id>" \
FANPASS_PRIVY_APP_CLIENT_ID="<public Privy app client id>" \
FANPASS_STRIPE_PUBLISHABLE_KEY="pk_test_<redacted>" \
npm run ios:archive:beta
```

The helper writes archives and logs under ignored `outputs/ios-archives/`. It requires an HTTPS non-placeholder API URL and caller-supplied signing variables. It does not write Apple team ids, provisioning profile names, Privy values, Stripe keys, or export options into source control.

Next required external setup:

- Sign in to Xcode with the Apple Developer account.
- Create or confirm App Store Connect apps and bundle IDs for `com.fanpass.app` and `com.fanpass.ops`.
- Enable NFC Tag Reading only for the `FanPass Ops` identifier.
- Create/download Apple Development and Apple Distribution signing identities.
- Create/download development and App Store/TestFlight provisioning profiles for both apps.
- Keep real Team ID/profile names outside source control and inject them with environment variables.
- Replace placeholder staging/beta API values only through build settings or external configuration for signed builds; checked-in configs should remain secret-free.
- Complete Privy mobile app config evidence before trusting real public Privy app/client IDs in staging or beta.
- Use a real iPhone, dynamic QR, and a physical NFC-compatible NDEF fixture tag to complete `ops-scanner` evidence; simulator, paste fallback, localhost API, raw payload screenshots, or non-NDEF RFID cards cannot close the physical QR/NFC blocker.

## Security Position

TestFlight does not make the product security-ready. It only solves distribution. FanPass still must keep authentication, authorization, payment state, ticket ownership, QR/NFC verification, and PII redaction as release blockers before any real-user or real-event test.
