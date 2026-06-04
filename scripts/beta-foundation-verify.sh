#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "== FanPass Beta foundation local gates =="

run_step() {
  local label="$1"
  shift
  echo
  echo "-- $label"
  "$@"
}

run_step "API Prisma client generation" npm run prisma:generate -w apps/api
run_step "API contract audit self-test" npm run security:api-contracts:self-test
run_step "API contract audit" npm run security:api-contracts
run_step "API route role matrix audit self-test" npm run security:route-roles:self-test
run_step "API route role matrix audit" npm run security:route-roles
run_step "API response privacy audit self-test" npm run security:api-privacy:self-test
run_step "API response privacy audit" npm run security:api-privacy
run_step "Payment response redaction audit self-test" npm run security:payment-response-redaction:self-test
run_step "Payment response redaction audit" npm run security:payment-response-redaction
run_step "Console route contract audit self-test" npm run security:console-routes:self-test
run_step "Console route contract audit" npm run security:console-routes
run_step "Node runtime policy audit self-test" npm run security:node-runtime-policy:self-test
run_step "Node runtime policy audit" npm run security:node-runtime-policy
run_step "CI Node 22 workflow audit self-test" npm run security:ci-node22-workflow:self-test
run_step "CI Node 22 workflow audit" npm run security:ci-node22-workflow
run_step "Hosted CI evidence validator self-test" npm run security:ci-hosted:evidence:self-test
run_step "Saved evidence redaction audit self-test" npm run security:evidence-redaction:self-test
run_step "Saved evidence redaction audit" npm run security:evidence-redaction
run_step "Dependency advisory state check self-test" npm run security:dependency-advisories:self-test
run_step "Dependency advisory state check" npm run security:dependency-advisories
run_step "Dependency risk evidence validator self-test" npm run security:dependency-risk:evidence:self-test
run_step "Dependency tooling audit self-test" npm run security:dependency-tooling:self-test
run_step "Dependency tooling audit" npm run security:dependency-tooling
run_step "Privy webhook optionality audit self-test" npm run security:privy-webhooks:optional:self-test
run_step "Privy webhook optionality audit" npm run security:privy-webhooks:optional
run_step "Privy local config check self-test" npm run security:privy-local-config:self-test
run_step "Privy evidence draft helper self-test" npm run privy:evidence:draft:self-test
run_step "Release evidence draft helper self-test" npm run release:evidence:draft:self-test
run_step "Privy plan evidence validator self-test" npm run security:privy-plan:evidence:self-test
run_step "Privy mobile app config evidence validator self-test" npm run security:privy-mobile-app-config:evidence:self-test
run_step "Privy Console React SDK isolation validator self-test" npm run security:privy-console-react-sdk:isolation:self-test
run_step "Stripe dashboard evidence validator self-test" npm run security:stripe-dashboard:evidence:self-test
run_step "Stripe test-mode evidence validator self-test" npm run security:stripe-testmode:evidence:self-test
run_step "Apple Wallet signed-pass evidence validator self-test" npm run security:apple-wallet:evidence:self-test
run_step "FanPass Ops device scanner evidence validator self-test" npm run security:ops-scanner:device-evidence:self-test
run_step "NFC NDEF fixture format audit self-test" npm run security:nfc-ndef-fixture:self-test
run_step "NFC NDEF fixture format audit" npm run security:nfc-ndef-fixture
run_step "Alpha demo script audit self-test" npm run alpha:demo-script:audit:self-test
run_step "Alpha demo script audit" npm run alpha:demo-script:audit
run_step "Alpha walkthrough evidence audit self-test" npm run alpha:walkthrough:evidence:audit:self-test
run_step "Alpha walkthrough evidence audit" npm run alpha:walkthrough:evidence:audit
run_step "Alpha walkthrough recording evidence validator self-test" npm run alpha:walkthrough:recording:evidence:self-test
run_step "Alpha walkthrough capture self-test" npm run alpha:walkthrough:capture:self-test
run_step "Provider boundary audit self-test" npm run security:provider-boundaries:self-test
run_step "Provider and lifecycle boundary audit" npm run security:provider-boundaries
run_step "Chain operator key boundary audit self-test" npm run security:chain-operator-key:self-test
run_step "Chain operator key boundary audit" npm run security:chain-operator-key
run_step "Chain custody evidence validator self-test" npm run security:chain-custody:evidence:self-test
run_step "Engineering quality gate audit self-test" npm run security:engineering-gates:self-test
run_step "Engineering quality gate audit" npm run security:engineering-gates
run_step "iOS distribution boundary audit self-test" npm run security:ios-distribution-boundaries:self-test
run_step "iOS distribution boundary audit" npm run security:ios-distribution-boundaries
run_step "iOS staging/TestFlight build evidence validator self-test" npm run security:ios-staging-build:evidence:self-test
run_step "iOS physical-device QA checklist audit self-test" npm run security:ios-physical-device-qa:self-test
run_step "iOS physical-device QA checklist audit" npm run security:ios-physical-device-qa
run_step "Staff invite policy audit self-test" npm run security:staff-invite-policy:self-test
run_step "Staff invite policy audit" npm run security:staff-invite-policy
run_step "Staff tenant staging evidence validator self-test" npm run security:staff-tenant:staging-evidence:self-test
run_step "Prototype reset policy audit self-test" npm run security:prototype-reset-policy:self-test
run_step "Prototype reset policy audit" npm run security:prototype-reset-policy
run_step "Prototype shortcut register audit self-test" npm run security:prototype-shortcuts:self-test
run_step "Prototype shortcut register audit" npm run security:prototype-shortcuts
run_step "Beta local start safety self-test" npm run beta:local:start:self-test
run_step "Beta local verification self-test" npm run beta:local:verify:self-test
run_step "Local runtime security check self-test" npm run security:runtime:local:self-test
run_step "Staging runtime security check self-test" npm run security:runtime:staging:self-test
run_step "Staging runtime evidence validator self-test" npm run security:runtime:staging:evidence:self-test
run_step "Security header policy audit self-test" npm run security:headers-policy:self-test
run_step "Security header policy audit" npm run security:headers-policy
run_step "Settlement retry idempotency audit self-test" npm run security:settlement-retry-idempotency:self-test
run_step "Settlement retry idempotency audit" npm run security:settlement-retry-idempotency
run_step "Side-effect worker saga verification self-test" npm run side-effects:verify:self-test
run_step "Side-effect worker saga verification" npm run side-effects:verify
run_step "Side-effect outbox health self-test" npm run side-effects:health:self-test
run_step "Side-effect outbox health check" npm run side-effects:health
run_step "API typecheck" npm run typecheck -w apps/api
run_step "Console typecheck" npm run typecheck -w apps/dashboard
run_step "API unit tests" npm run test -w apps/api

echo
echo "Beta foundation local gates passed."
