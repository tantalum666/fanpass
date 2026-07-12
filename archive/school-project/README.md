# Completed School Project Archive

Archived on 2026-07-11 after the coursework and hardware demonstration were completed.

This directory is intentionally outside the active npm workspace and product source tree. Its contents are preserved for reference and are not part of normal FanPass builds, tests, deployment, or release scope.

## Contents

- `school-web/`: the completed ITP4457 coursework web application, including its local server and submission handoff.
- `hardware/`: the Arduino UNO R4 WiFi turnstile sketch, enclosure generators, and ignored local CAD outputs.
- `scripts/fanpass-turnstile-redemption-bridge.mjs`: the USB serial-to-backend redemption bridge used by the physical turnstile demo.
- `archive/school-project/docs/FanPass_Turnstile_Enclosure_Spec.md`: the completed enclosure design notes.
- `archive/school-project/docs/FANPASS_REPORT.md`: the final coursework report source.

## Archive Rules

- Do not include these paths in active FanPass CI, deployment, release evidence, or routine Markdown startup decisions.
- Do not delete ignored CAD outputs or school-web local data unless explicitly requested; they may contain useful local project artifacts.
- Restoring a component to active development requires moving it back into the active tree and re-adding its workspace/scripts deliberately.

## Running The Archived School Web

The archived app is standalone:

```bash
npm install --prefix archive/school-project/school-web
npm run dev --prefix archive/school-project/school-web
```

The archived turnstile bridge no longer starts automatically and the previously running background process was stopped during archival.
