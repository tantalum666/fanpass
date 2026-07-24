# FanPass iOS Distribution Plan

Originally dated: 2026-05-29
Last updated: 2026-07-25

## Scope

This plan covers native iOS distribution for two separate apps:

- `FanPass` - consumer app for fans.
- `FanPass Ops` - gate staff and onsite operations app.

`FanPass Console` remains web-first and is not distributed through the App Store.

## Current Local Targets

| App         | Current bundle id | Current scheme | Role                                           |
| ----------- | ----------------- | -------------- | ---------------------------------------------- |
| FanPass     | `fun.fanpass.app` | `FanPass`      | Consumer discovery, wallet, market, fan access |
| FanPass Ops | `com.fanpass.ops` | `FanPassOps`   | QR-first gate scan and redemption              |

Both bundle ids now have App Store Connect/TestFlight upload history. Keep them unless the owner deliberately creates new app records and accepts a migration; bundle ids are difficult to change after distribution history exists.

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

- A Camera purpose string is present for Apple's binary/API scan requirement; the current FanPass target still contains no scanner source.
- No NFC entitlement.
- Push notifications are optional later.
- Associated Domains are optional later for universal links.
- Apple Wallet pass presentation can be added after a signed `.pkpass` backend exists. Near-term Wallet scope is barcode-based signed passes; NFC/tap-to-reader Wallet entry requires separate Apple entitlement/access and should be treated as future venue/enterprise work.
- Near-term entry presentation is a dynamic, short-lived QR displayed by the fan app, not a user-carried NFC/RFID tag.

FanPass Ops:

- Camera permission for QR scanning.
- Current TestFlight/internal builds are QR-first. Native Core NFC is DEBUG-only after App Store Connect rejected the release archive's NDEF entitlement on 2026-06-16.
- NFC Tag Reading for Core NFC NDEF scanning remains a future internal fixture/prototype path, to be reintroduced only after the supported Apple entitlement/profile path and physical NDEF evidence are available.
- No consumer wallet, market, or organizer controls.
- Device testing is required because simulator cannot validate camera hardware or NFC reading.

Do not enable broad capabilities by default. Add each capability only when the product surface actually needs it.

## Environment Strategy

Use separate build configurations or `.xcconfig` files before TestFlight:

| Environment     | API base URL                                                      | Data/payment mode                | Intended audience         |
| --------------- | ----------------------------------------------------------------- | -------------------------------- | ------------------------- |
| Local Debug     | `Config/Local.xcconfig` -> deployed Staging HTTPS by default      | real Staging services            | Simulator and development |
| Staging Debug   | `Config/Staging.xcconfig` -> replace with HTTPS staging API       | Stripe test mode, Privy test app | Founder/internal QA       |
| TestFlight Beta | `Config/Beta.xcconfig` -> replace with HTTPS beta API             | Stripe test mode only            | Closed external testers   |
| Production      | `Config/Production.xcconfig` -> replace with HTTPS production API | Production-grade providers only  | Future public launch      |

Local HTTP is allowed only through an explicit gitignored `LocalSecrets.xcconfig` override while a developer is intentionally running the local API. It must never be the checked-in default and must not ship in TestFlight. Both apps use the environment-aware API client before external testers receive builds.

## TestFlight Rollout Stages

1. Physical-device internal install
   - Goal: prove signing, app launch, local navigation, QR camera, and API connectivity. Native NFC is a separate future capability gate for the current QR-first Release/TestFlight Ops path.
   - Audience: founder/developer devices only.
   - Exit: both apps install outside simulator; Ops camera permission and QR/API redemption behave correctly. NFC does not block this QR-first stage.

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
- Release/TestFlight UI exposes QR only and does not advertise unavailable NFC controls; native NFC controls, CoreNFC import/session code, and NDEF fixture work remain DEBUG-only.
- If NFC is deliberately restored later, a supported NDEF fixture must enter the same backend-authoritative redemption path; users are not expected to carry generic NFC/RFID tags for current admission.
- Accepted/rejected counts update.
- Paste fallback is hidden or debug-gated before external testers unless explicitly risk-accepted.
- Wallet payload copy and barcode JSON copy remain debug-gated payload copy/paste helpers for local simulator QA only.

Shared:

- API base URL is HTTPS and staging-specific.
- Demo auth is disabled in public/staging-like runtimes.
- Privy public app/client IDs remain injected outside source control, and `FanPassEnvironment` keeps a Privy public-config secret guard so secret-like values are ignored rather than treated as app configuration.
- Stripe PaymentSheet remains test-mode only for current Beta: checked-in iOS configs stay free of Stripe publishable keys, and the `FanPassEnvironment` runtime accessor keeps a test publishable-key runtime guard that accepts only `pk_test_` values supplied outside source control.
- Runtime security checks must pass against the exact deployed RC before the evidence is accepted.
- Privacy-scoped responses and redaction are enabled.
- `npm run security:ios-distribution-boundaries` passes, proving the FanPass target has a camera purpose string but no scanner source or NFC capability, FanPass Ops owns QR camera scanning and keeps native Core NFC DEBUG-only for the current QR-first TestFlight path, release API configs stay HTTPS-only and secret-free, Privy public-config secret guard stays enforced, and Apple Wallet stays a signed `.pkpass` blocker rather than a fake local pass flow.
- Saved real-device or TestFlight build evidence passes `npm run security:ios-staging-build:evidence -- <saved-json-output>`, proving both apps used real HTTPS staging/beta API URLs, signed builds, physical-device or TestFlight install evidence, debug helper removal, role separation, the `qr-first-release-v1` capability model, the current iOS distribution/config/scanner implementation SHA-256 snapshot, deployment/cloud credential absence, CI secret masking command redaction, and redaction.

## Beta Blockers

- Apple Developer account access is available as of 2026-06-10. Authenticated App Store Connect review on 2026-07-24 confirms the historical builds remain available: FanPass `1.0 (2)` shows 3 installs and 108 app sessions; FanPass Ops `1.0 (1)` shows 2 installs and 24 app sessions; neither build shows a recorded crash. This live distribution data and the owner's confirmation establish that TestFlight installation plus physical-iPhone QR validation were completed. A fresh signed archive and version-bound TestFlight/iPhone QR re-attestation for the next reviewed `qr-first-release-v1` candidate remain open.
- App Store Connect currently reports an updated Apple Developer Program License Agreement that the account holder must accept before existing apps can be updated or new apps submitted. On 2026-07-25 Computer Use reached the final `Agree` button and stopped for the required action-time confirmation. The DSA flow was also opened and presents two legal-fact choices: `trader` or `not a trader / no EU distribution`; neither was selected. These decisions must come from the owner and must not be inferred from the account's individual enrollment type.
- Signing preflight on 2026-07-25 found Xcode 26.5, XcodeGen, and one valid code-signing identity, but zero provisioning profiles in the standard local profile directory. After the agreement is accepted, Xcode/App Store Connect must restore or download explicit profiles for both bundle IDs before `ios:archive:beta` can produce new signed archives.
- Environment-specific iOS API configuration exists through build settings/xcconfig injection, but signed TestFlight evidence with real HTTPS beta/staging values is still open.
- `FanPass Ops` release/TestFlight path is QR-first for now. NFC NDEF evidence remains open and should not block initial internal TestFlight QR testing.
- Apple Wallet `.pkpass` signing is not implemented.
- NFC/contactless Apple Wallet ticket presentation is not in current scope. It requires special Apple entitlement/access, compatible reader protocol, and likely organization-level Apple Developer Program status plus Apple approval/agreements; it is different from standard QR/barcode `.pkpass` support.
- Privy Swift SDK login is wired locally for FanPass and FanPass Ops through placeholder public app/client IDs only; real dashboard evidence and non-placeholder staging/beta app configuration are still open.
- Real Privy mobile app configuration evidence is not saved yet. Future evidence must pass `npm run security:privy-mobile-app-config:evidence -- <saved-json-output>` with deployment credential and CI masking-command redaction proof before non-placeholder app/client IDs are trusted for staging, beta, or TestFlight-style builds.
- Stripe client UI and real Stripe test-mode webhook validation passed for an earlier deployed revision; current-RC Stripe/provider evidence must be regenerated after the approved Staging cutover.
- The deployed Render API is an older revision. Historical TestFlight/iPhone QR results do not attest the current source; current-candidate signed TestFlight/QR refresh, live settlement, App Attest, and signed Wallet evidence remain open.

## Implementation Tasks

- Replace placeholder staging, beta, and production API URLs in the checked-in xcconfig files once real HTTPS endpoints exist.
- Keep `FanPassAPIBaseURL` wired through Info.plist/build settings instead of hardcoding API URLs in Swift views.
- Keep `npm run security:ios-distribution-boundaries:self-test` and `npm run security:ios-distribution-boundaries` wired into `node scripts/beta-foundation-verify.js` while replacing placeholders with real HTTPS staging/beta/production endpoints.
- Keep `npm run security:ios-staging-build:evidence:self-test` wired into `node scripts/beta-foundation-verify.js` before relying on saved real-device or TestFlight build evidence.
- Keep `npm run security:ops-scanner:device-evidence:self-test` wired into `node scripts/beta-foundation-verify.js`; current saved device proof is QR-first and must reject legacy NFC claims until a separate release capability is reviewed and re-enabled.
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

## Historical 2026-06-10 TestFlight / Physical QR-NFC Push

The owner confirmed Apple Developer account access and redirected priority from web/management concepts to iOS TestFlight plus physical QR/NFC validation.

Historical 2026-06-10 local verification:

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

Later historical execution, clarified by the owner on 2026-07-24:

- Both native apps reached signed iPhoneOS builds with embedded provisioning profiles, and both bundle ids accumulated App Store Connect/TestFlight upload history.
- TestFlight installation and physical-iPhone QR validation were completed on the historical build line.
- The draft JSON files above were never promoted into passing saved-evidence records. That is evidence-bookkeeping debt, not proof that the historical tests never happened.
- Because the scanner/runtime bytes have changed since then, the next deployment needs a fresh candidate-bound TestFlight/QR capture; it should reuse the proven path instead of reopening first-time setup.

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
- Create or confirm App Store Connect apps and bundle IDs for `fun.fanpass.app` and `com.fanpass.ops`.
- Do not enable NFC Tag Reading for the current App Store/TestFlight `FanPass Ops` release archive. The 2026-06-16 upload was rejected for the NDEF entitlement, so current internal TestFlight should proceed QR-first.
- Create/download Apple Development and Apple Distribution signing identities.
- Create/download development and App Store/TestFlight provisioning profiles for both apps.
- Keep real Team ID/profile names outside source control and inject them with environment variables.
- Replace placeholder staging/beta API values only through build settings or external configuration for signed builds; checked-in configs should remain secret-free.
- Complete Privy mobile app config evidence before trusting real public Privy app/client IDs in staging or beta.
- Repeat the proven real-iPhone dynamic-QR path against the next reviewed TestFlight candidate and save validator-passing, redacted, version-bound evidence. Physical NFC-compatible NDEF fixture evidence remains a separate future blocker; simulator, paste fallback, localhost API, raw payload screenshots, or non-NDEF RFID cards cannot close it.

## 2026-06-16 App Store Connect Upload Notes

- Xcode Organizer uploads use `App Store Connect` as the destination. Successful builds then appear under TestFlight in App Store Connect.
- The first `FanPassOps` upload failed because the release archive contained the Core NFC NDEF entitlement. The current source removes that release entitlement and gates native Core NFC to DEBUG builds.
- The next `FanPassOps` upload failed because no supported interface orientations were specified while the app targets iPhone and iPad. Both `FanPassOps/Generated/Info.plist` and `FanPass/Generated/Info.plist` now declare portrait, portrait upside down, landscape left, and landscape right.
- The next upload completed transport/SPI polling but failed App Store Connect validation because `com.fanpass.ops` was missing `CFBundleIconName`. Both app Info.plists now declare `CFBundleIconName: AppIcon`, and the shared `FanPass/Assets.xcassets/AppIcon.appiconset` is included in both targets so the built apps contain `Assets.car`, `CFBundleIcons`, and iPhone/iPad app icon files.
- After the icon fix, the build appeared in TestFlight but App Store Connect showed `Missing Export Compliance`. Current iOS source does not implement app-owned custom/non-standard encryption, so answer `None of the above` in the App Store Connect encryption questionnaire for the current build. Both app Info.plists now include `ITSAppUsesNonExemptEncryption: false` through `project.yml` so fresh archives carry the same declaration.
- The first main `FanPass` upload was rejected by email with `ITMS-90683: Missing purpose string in Info.plist` because the bundle lacked `NSCameraUsageDescription`. The main app now declares a camera purpose string for camera-based ticket QR entry/support flows, matching Apple's binary/API scan requirement. The historical corrected upload used version `1.0` build `2`; a future RC archive must use a new build number and fresh evidence.
- Always create a fresh archive after these fixes. Previously exported archives still contain the old Info.plist or entitlement payload and will keep failing validation.

## Security Position

TestFlight does not make the product security-ready. It only solves distribution. FanPass still must keep authentication, authorization, payment state, ticket ownership, QR/NFC verification, and PII redaction as release blockers before any real-user or real-event test.
