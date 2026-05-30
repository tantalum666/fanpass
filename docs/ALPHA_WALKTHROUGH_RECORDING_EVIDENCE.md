# FanPass Alpha Walkthrough Recording Evidence

Status: saved recording review evidence gate ready; human-reviewed recording artifact remains open.

This file defines the saved JSON evidence contract for closing the Alpha walkthrough recording task. The local capture bundle under `outputs/alpha-walkthrough/20260529T182908Z/` can support review, but it is not the recording artifact.

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
- The verification commands `npm run alpha:demo-script:audit`, `npm run alpha:walkthrough:evidence:audit`, `npm run beta:foundation:verify`, `npm run beta:local:start`, `npm run beta:local:verify`, `npm run beta:local:stop`, and `npm run security:evidence-redaction`.
- Visual review proof that FanPass has no staff controls, FanPass Ops owns scanner flow, FanPass Console owns organizer/admin controls, local-only scope is disclosed, external Beta readiness is not claimed, and remaining blockers are named.
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
        "file": "scripts/beta-foundation-verify.sh",
        "sha256": "<current-sha256>"
      }
    ]
  }
}
```

The snapshot must be regenerated after the demo script, walkthrough evidence contract, capture command, recording evidence validator, recording evidence self-test, or Beta foundation verifier changes.

## Forbidden evidence

- Do not include real emails, wallet addresses, QR nonces, signed QR payloads, bearer tokens, provider secrets, Stripe keys, Privy secrets, deployment credentials, database URLs, private keys, Apple signing material, device identifiers, or production credentials.
- Do not claim the recording proves real Privy login, real Stripe webhooks, deployed staging, signed Wallet passes, TestFlight, real-device NFC, hosted CI, chain custody, or public Beta readiness.
- Do not close the `Record an Alpha walkthrough using the frozen local script` task until a real human-reviewed recording artifact exists and its saved review JSON passes this validator.
