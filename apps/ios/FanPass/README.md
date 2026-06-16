# FanPass iOS

Native SwiftUI app source for the FanPass beta target.

This folder currently contains the SwiftUI source layout and a project manifest. A full Xcode installation is required to generate, build, and run the app on simulator or device.

## Intended Targets

- FanPass: event discovery, ticket wallet, fan access, and marketplace.
- FanPass Ops: dynamic QR verification for current TestFlight/internal testing.

Native Core NFC remains DEBUG-only for now. The first App Store Connect upload
attempt rejected the release archive's NDEF entitlement, so release/TestFlight
Ops builds should be treated as QR-first until a supported NFC entitlement and
physical NDEF evidence path is reintroduced.

## Build Note

Xcode is required to generate, build, and run the apps. If the selected developer directory is not Xcode, select it:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## TestFlight / Signed Archive Helper

Use the root helper after Xcode is signed in to the Apple Developer account and the required local certificates/profiles are installed:

```bash
FANPASS_APPLE_TEAM_ID="<team id>" \
FANPASS_FANPASS_PROVISIONING_PROFILE_SPECIFIER="<FanPass profile name>" \
FANPASS_OPS_PROVISIONING_PROFILE_SPECIFIER="<FanPass Ops profile name>" \
FANPASS_API_BASE_URL="https://<staging-or-beta-api>" \
FANPASS_PRIVY_APP_ID="<public Privy app id>" \
FANPASS_PRIVY_APP_CLIENT_ID="<public Privy app client id>" \
FANPASS_STRIPE_PUBLISHABLE_KEY="pk_test_<redacted>" \
npm run ios:archive:beta
```

The helper writes archives and logs under ignored `outputs/ios-archives/`. Keep Apple signing values, provisioning profile names, Privy values, Stripe keys, export options, and App Store Connect credentials out of source control and saved evidence.

After changing Info.plist, entitlements, signing, or bundle identifiers, create a
fresh archive before uploading. Old Organizer archives keep their original
plist/entitlement contents and will continue to fail App Store Connect validation
even after source fixes are committed.

## Local Provider Config

For local or device smoke builds, use the gitignored override:

```bash
cp Config/LocalSecrets.xcconfig.example Config/LocalSecrets.xcconfig
```

Fill public API/Privy/Stripe values there. `Config/*.xcconfig` uses
`#include? "LocalSecrets.xcconfig"`, so the app keeps those local values after
`xcodegen generate` recreates `FanPass.xcodeproj`. Do not put private keys,
Privy verification keys, bearer tokens, webhook secrets, database URLs, or live
Stripe secrets in this file.
