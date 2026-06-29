# FanPass NFC NDEF Tag Fixture Format

Status: fixture contract ready; physical-device validation remains open.

Current release/TestFlight status as of 2026-06-16: native Core NFC is DEBUG-only.
App Store Connect rejected the `FanPass Ops` release archive's NDEF entitlement,
so the first internal TestFlight path is QR-first. This NFC fixture remains the
future contract for reintroducing native NDEF scanning after the supported Apple
entitlement/profile path is available.

## Scope

This document defines the supported NFC test-tag payload format for `FanPass Ops` only. It does not add NFC capability to the consumer `FanPass` app, and it does not close physical-device validation until saved scanner evidence passes the real-device evidence gate.

NFC is a transport for a FanPass signed entry payload. Backend authority remains FanPass API signature verification, nonce replay rejection, authenticated scanner identity, and gate assignment enforcement. NFC payloads must enter the same redemption path as QR scans.

For live admission, FanPass API ticket state is the synchronous source of truth. A tag or QR can only request redemption; it is not proof of entry by itself. The backend must atomically accept at most one redemption per ticket, consume the accepted dynamic entry credential, reject stale/superseded/expired credentials, and record duplicate/rejected attempts for gate audit. Chain writes and proof sync are asynchronous evidence paths and must not be treated as the gate decision.

This is an internal reader-fixture contract, not the intended fan admission experience. Fans must not be expected to carry a separate NFC/RFID tag for entry. The current TestFlight/MVP admission path should be phone-to-phone dynamic QR: the fan iPhone displays a short-lived signed entry payload as QR, and the `FanPass Ops` iPhone scans it. iPhone-to-iPhone NFC presentation is not part of the current Core NFC reader implementation and should be treated as a future Apple-entitlement/terminal-protocol workstream, not a near-term blocker.

## RFID Compatibility

`RFID` is a broad hardware label and is not automatically compatible with this fixture. The current `FanPass Ops` implementation uses `NFCNDEFReaderSession`, so a physical test card/sticker must be readable as an NFC NDEF tag.

Usable for this fixture:

- NFC Forum-compatible tags that can store an NDEF Text or URI record.
- 13.56 MHz tags supported by iPhone Core NFC and writable with an NDEF record.
- NTAG216 is preferred for the current debug URI size; NTAG215 may work for shorter signed payloads; NTAG213 may be too small for realistic payloads.

Not sufficient for this fixture:

- LF 125 kHz RFID cards/fobs.
- UHF RFID tags.
- Access-control cards that expose only a proprietary identifier and cannot store an NDEF record.
- Cards that an iPhone/NFC writing app cannot detect or cannot format/write as NDEF.

Quick field check: use a known NFC writer app such as NFC Tools on an iPhone. If the app can read the card and write an NDEF Text or URI record containing the `fanpass://entry?payload=...` test URI, the card can be used for this fixture. If the app cannot detect it or cannot write NDEF, it cannot test the current FanPass Ops NFC path.

## 2026-06-15 EP8280 Bench NFC Note

An Arduino UNO R4 WiFi + EP8280 bench mock turnstile now exists under `hardware/fanpass_turnstile/fanpass_turnstile.ino`. It successfully reads QR text over the EP8280 TTL path, but NFC card/tag behavior has not been made to work in the bench setup.

Do not treat a blank card, generic RFID tag, or EP8280 NFC no-response test as proof that the FanPass NDEF fixture is working. For the current FanPass Ops NFC evidence path, the test artifact still needs to be an NFC-compatible physical NDEF tag that can store the supported Text or URI payload and be read by the signed FanPass Ops iPhone build.

The EP8280 bench may remain useful as a local QR/NFC hardware experiment, but it is separate from the iPhone Core NFC NDEF fixture contract and cannot close physical-device NFC evidence.

The 2026-06-24 enclosure CAD/STL work under `hardware/fanpass_turnstile/enclosure/` is mechanical cleanup for this local bench only. It does not change the NFC fixture contract, does not prove EP8280 NDEF behavior, and does not close physical-device NFC evidence.

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
- a physical NDEF tag written with a staging-only FanPass signed entry payload; for current testing this means a physical NFC-compatible NDEF tag, not a generic non-NDEF RFID card;
- a gate staff session from verified auth, not client-supplied scanner identity;
- duplicate replay coverage for the same NFC payload;
- same-ticket race coverage where two scans for the same ticket, including different signed nonces if available, produce one accepted redemption and duplicate/invalid rejection for the rest;
- an unsupported tag or unsupported device behavior check.

The debug paste fallback remains debug-only. External TestFlight or physical-device evidence must not use paste fallback as the NFC proof.

Physical-device evidence must pass `npm run security:ops-scanner:device-evidence -- <saved-json-output>` before physical QR/NFC validation is closed. This fixture contract only defines what the NFC test tag may contain.

## Redaction Requirements

Saved QA notes, screenshots, logs, and JSON evidence must redact bearer tokens, Privy tokens, QR signing secrets, payload nonces, signed payload strings, ticket identifiers, staff identifiers, device identifiers, provider secrets, Apple signing material, and real personal data.
