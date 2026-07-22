-- Durable admission and provider checkpoints for sponsored USDC sends.
-- Privy access tokens and authorization signatures must never be stored here.

CREATE TABLE IF NOT EXISTS "sponsored_crypto_submissions" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "request_key_hash" TEXT NOT NULL,
  "provider_idempotency_key" TEXT NOT NULL,
  "wallet_id" TEXT NOT NULL,
  "wallet_address" TEXT NOT NULL,
  "wallet_binding_version" INTEGER NOT NULL,
  "wallet_binding_fingerprint" TEXT NOT NULL,
  "chain_id" TEXT NOT NULL,
  "token_contract_address" TEXT NOT NULL,
  "receiver_address" TEXT NOT NULL,
  "amount_atomic" TEXT NOT NULL,
  "token_decimals" INTEGER NOT NULL,
  "transaction_data" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "lease_owner" TEXT,
  "lease_expires_at" TIMESTAMP(3),
  "provider_id" TEXT,
  "transaction_hash" TEXT,
  "ambiguity_deadline_at" TIMESTAMP(3) NOT NULL,
  "submitted_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "last_error_code" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sponsored_crypto_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsored_crypto_submissions_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "sponsored_crypto_submissions_payment_id_key"
  ON "sponsored_crypto_submissions"("payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sponsored_crypto_submissions_provider_idempotency_key_key"
  ON "sponsored_crypto_submissions"("provider_idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "sponsored_crypto_submissions_provider_id_key"
  ON "sponsored_crypto_submissions"("provider_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sponsored_crypto_submissions_transaction_hash_key"
  ON "sponsored_crypto_submissions"("transaction_hash");
CREATE INDEX IF NOT EXISTS "sponsored_crypto_submissions_status_lease_expires_at_idx"
  ON "sponsored_crypto_submissions"("status", "lease_expires_at");

ALTER TABLE "sponsored_crypto_submissions"
  DROP CONSTRAINT IF EXISTS "sponsored_crypto_submissions_status_check";
ALTER TABLE "sponsored_crypto_submissions"
  ADD CONSTRAINT "sponsored_crypto_submissions_status_check"
  CHECK ("status" IN (
    'SUBMITTING',
    'RETRYABLE',
    'PROVIDER_ACCEPTED',
    'HASH_AVAILABLE',
    'CONFIRMED',
    'FAILED',
    'COMPENSATION_REQUIRED',
    'AMBIGUOUS'
  ));
