# FanPass Alpha Walkthrough Recording Evidence

Status: optional saved recording review evidence gate ready; human-reviewed recording artifact is owner-skipped for current Beta foundation.

This file defines the saved JSON evidence contract for future Alpha walkthrough recording review if recording work is deliberately reintroduced. The owner removed the human-reviewed recording requirement from current Beta foundation blockers on 2026-06-04. The local capture bundle under `outputs/alpha-walkthrough/20260604T122652Z/` can support review, but it is not the recording artifact.

## Required saved evidence

Run the validator only on a redacted, local-only review JSON file:

```bash
npm run alpha:walkthrough:recording:evidence -- <saved-json-output>
```

The saved JSON must prove:

- `provider: "alpha-walkthrough-recording-review"`.
- `localOnly: true`.
- `realUserDataUsed: false`.
- `productionCredentialsUsed: false`.
- A human-reviewed recording file under `outputs/alpha-walkthrough/` with a `.mp4`, `.mov`, or `.webm` filename.
- `recording.demoScriptPath: "docs/ALPHA_DEMO_SCRIPT.md"`.
- `recording.usedFrozenScript: true`.
- `recording.supportingCaptureBundle` under `outputs/alpha-walkthrough/`.
- `recording.supportingCaptureOnly: true`, so capture bundles cannot be substituted for the actual recording artifact.
- All seven scenes from `docs/ALPHA_WALKTHROUGH_EVIDENCE.md` in order.
- The verification commands `npm run alpha:demo-script:audit`, `npm run alpha:walkthrough:evidence:audit`, `npm run alpha:walkthrough:capture`, `npm run beta:local:start`, `npm run beta:local:verify`, `npm run beta:local:stop`, and `npm run security:evidence-redaction`. The capture command must retain its reviewed-launcher digest check and pre-Node `/usr/bin/env -i` boundary; a bare runner or launcher command is not release evidence.
- Visual review proof that FanPass has no staff controls, FanPass Ops owns scanner flow, FanPass Console owns organizer/admin controls, local-only scope is disclosed, public/real-user Beta readiness is not claimed, and remaining blockers are named.
- Redaction proof for provider secrets, Stripe secrets and publishable keys, Privy secrets, bearer tokens, private keys, deployment credentials, personal data, wallet addresses, QR payloads, and production credentials.

## Recording policy snapshot

Future saved evidence must include the current Alpha walkthrough recording policy SHA-256 snapshot:

```json
{
  "recordingPolicySnapshot": {
    "source": "alpha-walkthrough-recording-review-policy",
    "files": [
      {
        "file": "docs/ALPHA_DEMO_SCRIPT.md",
        "sha256": "<current-sha256>"
      },
      {
        "file": "docs/ALPHA_WALKTHROUGH_EVIDENCE.md",
        "sha256": "<current-sha256>"
      },
      {
        "file": "docs/ALPHA_WALKTHROUGH_RECORDING_EVIDENCE.md",
        "sha256": "<current-sha256>"
      },
      {
        "file": "scripts/alpha-demo-script-audit.js",
        "sha256": "<current-sha256>"
      },
      {
        "file": "scripts/alpha-walkthrough-evidence-audit.js",
        "sha256": "<current-sha256>"
      },
      {
        "file": "scripts/alpha-walkthrough-capture.sh",
        "sha256": "<current-sha256>"
      },
      {
        "file": "scripts/alpha-walkthrough-recording-evidence-audit.js",
        "sha256": "<current-sha256>"
      },
      {
        "file": "scripts/alpha-walkthrough-recording-evidence-audit-self-test.js",
        "sha256": "<current-sha256>"
      },
      {
        "file": "scripts/beta-foundation-launcher.js",
        "sha256": "<current-sha256>"
      },
      {
        "file": "scripts/beta-foundation-launcher-self-test.js",
        "sha256": "<current-sha256>"
      },
      {
        "file": "scripts/lib/beta-foundation-bootstrap.js",
        "sha256": "<current-sha256>"
      },
      {
        "file": "scripts/beta-foundation-verify.js",
        "sha256": "<current-sha256>"
      }
    ]
  }
}
```

The snapshot must be regenerated after the demo script, walkthrough evidence contract, capture command, recording evidence validator/self-test, launcher/self-test, bootstrap, or Beta foundation runner changes.

## Forbidden evidence

- Do not include real emails, wallet addresses, QR nonces, signed QR payloads, bearer tokens, provider secrets, Stripe keys, Privy secrets, deployment credentials, database URLs, private keys, Apple signing material, device identifiers, or production credentials.
- Do not claim the recording proves production tenant/staff staging policy, signed Wallet passes, TestFlight, physical QR/NFC device validation, chain custody, clean public dependency posture, or public Beta readiness.
- Do not use this optional validator to claim public or real-user Beta readiness. If recording work is reintroduced, do not claim the recording is reviewed until a real human-reviewed recording artifact exists and its saved review JSON passes this validator.
