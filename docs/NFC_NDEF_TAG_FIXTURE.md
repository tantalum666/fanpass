# FanPass NFC NDEF Tag Fixture Format

Status: fixture contract ready; physical-device validation remains open.

## Scope

This document defines the supported NFC test-tag payload format for `FanPass Ops` only. It does not add NFC capability to the consumer `FanPass` app, and it does not close physical-device validation until saved scanner evidence passes the real-device evidence gate.

NFC is a transport for a FanPass signed entry payload. Backend authority remains FanPass API signature verification, nonce replay rejection, authenticated scanner identity, and gate assignment enforcement. NFC payloads must enter the same redemption path as QR scans.

## Supported NDEF Records

Use one of these NDEF record types for internal QA tags:

- NDEF Text record: UTF-8 text containing exactly one FanPass signed entry payload placeholder during documentation or exactly one real staging test payload during physical QA.
- NDEF URI record: HTTPS or app-specific URI whose payload query value contains exactly one FanPass signed entry payload placeholder during documentation or exactly one real staging test payload during physical QA.

Fixture documentation and saved examples must use placeholders such as `<REDACTED_SIGNED_ENTRY_PAYLOAD>`, `<REDACTED_STAGING_API_URL>`, `<REDACTED_TEST_EVENT>`, and `<REDACTED_TEST_GATE>`. Do not include copyable signed payload strings in committed docs, logs, screenshots, or saved evidence.

## Forbidden Tag Contents

Do not put bearer tokens on NFC tags.
Do not put Privy tokens on NFC tags.
Do not put Stripe secrets on NFC tags.
Do not put QR signing secrets on NFC tags.
Do not put raw nonces on NFC tags.
Do not put raw signed payload fixtures in committed docs or saved evidence.
Do not put real ticket ids on NFC tags used for committed evidence.
Do not put staff ids on NFC tags used for committed evidence.
Do not put device identifiers on NFC tags used for committed evidence.
Do not put real personal data on NFC tags.

The tag can carry only the scanner payload that FanPass API already signs for entry. The mobile client must not treat the tag as proof of entitlement by itself.

## Physical QA Runbook

Physical NFC QA must use:

- a signed `FanPass Ops` build installed on a real iPhone;
- a real HTTPS staging or beta API URL, not localhost and not a placeholder `.invalid` URL;
- a physical NDEF tag written with a staging-only FanPass signed entry payload;
- a gate staff session from verified auth, not client-supplied scanner identity;
- duplicate replay coverage for the same NFC payload;
- an unsupported tag or unsupported device behavior check.

The debug paste fallback remains debug-only. External TestFlight or physical-device evidence must not use paste fallback as the NFC proof.

Physical-device evidence must pass `npm run security:ops-scanner:device-evidence -- <saved-json-output>` before physical QR/NFC validation is closed. This fixture contract only defines what the NFC test tag may contain.

## Redaction Requirements

Saved QA notes, screenshots, logs, and JSON evidence must redact bearer tokens, Privy tokens, QR signing secrets, payload nonces, signed payload strings, ticket identifiers, staff identifiers, device identifiers, provider secrets, Apple signing material, and real personal data.
