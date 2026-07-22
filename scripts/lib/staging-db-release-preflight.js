"use strict";

const { createHash, timingSafeEqual } = require("crypto");

const PREFLIGHT_VERSION = "fanpass-staging-db-release-preflight-v1";
const EXPECTED_OWNERSHIP_ADAPTER = "privy";
const OWNERSHIP_CONTRACT_VERSION = "fanpass-ticket-v1";
const DATABASE_IDENTITY_VERSION = "fanpass-staging-database-identity-v3";
const DATABASE_IDENTITY_ENV = "FANPASS_STAGING_DATABASE_IDENTITY_SHA256";
const REQUIRED_STAGING_SSL_MODE = "require";
const REQUIRED_STAGING_SSL_ACCEPT = "strict";
const ALLOWED_DATABASE_URL_PARAMS = new Set([
  "connect_timeout",
  "connection_limit",
  "pgbouncer",
  "pool_timeout",
  "schema",
  "socket_timeout",
  "sslaccept",
  "sslmode",
]);
const KNOWN_SIDE_EFFECT_TYPES = Object.freeze([
  "OWNERSHIP_ISSUE",
  "OWNERSHIP_ISSUE_RECEIPT_POLL",
  "OWNERSHIP_TRANSFER",
  "OWNERSHIP_RECEIPT_POLL",
  "OWNERSHIP_REDEEM",
  "OWNERSHIP_REDEEM_RECEIPT_POLL",
  "OWNERSHIP_SETTLEMENT_FINALIZE",
  "PAYMENT_INTENT_CREATE",
  "PAYMENT_CAPTURE",
  "PAYMENT_CANCEL_AUTHORIZATION",
  "PAYMENT_REFUND",
  "PAYMENT_RECONCILE",
  "ORDER_MATCH_AFTER_PAYMENT_AUTH",
]);
const KNOWN_SIDE_EFFECT_TYPE_SQL = KNOWN_SIDE_EFFECT_TYPES.map(
  (type) => `'${type}'`,
).join(",\n          ");

const IDENTITY_QUERY = String.raw`
SELECT
  current_setting('transaction_read_only') = 'on' AS "transactionReadOnly",
  current_database() AS "databaseName",
  current_user AS "databaseUser",
  current_schema() AS "databaseSchema",
  session_user AS "databaseSessionUser"
`;

const SCHEMA_QUERY = String.raw`
SELECT
  current_setting('transaction_read_only') = 'on' AS "transactionReadOnly",
  current_database() AS "databaseName",
  current_user AS "databaseUser",
  current_schema() AS "databaseSchema",
  session_user AS "databaseSessionUser",
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'tickets'
  ) AS "ticketsTable",
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'side_effect_outbox'
  ) AS "sideEffectOutboxTable",
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'users'
  ) AS "usersTable",
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'payments'
  ) AS "paymentsTable",
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'sponsored_crypto_submissions'
  ) AS "sponsoredCryptoSubmissionsTable",
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'side_effect_dispatch_control'
  ) AS "sideEffectDispatchControlTable",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'tickets'
      AND column_name = 'token_id'
      AND data_type = 'text' AND is_nullable = 'YES'
  ) AS "ticketTokenIdColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'tickets'
      AND column_name = 'ownership_contract_address'
      AND data_type = 'text' AND is_nullable = 'YES'
  ) AS "ticketOwnershipContractAddressColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'tickets'
      AND column_name = 'ownership_chain_id'
      AND data_type = 'text' AND is_nullable = 'YES'
  ) AS "ticketOwnershipChainIdColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'tickets'
      AND column_name = 'ownership_contract_version'
      AND data_type = 'text' AND is_nullable = 'YES'
  ) AS "ticketOwnershipContractVersionColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_outbox'
      AND column_name = 'type'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) AS "outboxTypeColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_outbox'
      AND column_name = 'status'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) AS "outboxStatusColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_outbox'
      AND column_name = 'payload_json'
      AND data_type = 'jsonb' AND is_nullable = 'NO'
  ) AS "outboxPayloadColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_outbox'
      AND column_name = 'last_error'
      AND data_type = 'text' AND is_nullable = 'YES'
  ) AS "outboxLastErrorColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_outbox'
      AND column_name = 'available_at'
      AND data_type = 'timestamp without time zone' AND is_nullable = 'NO'
  ) AS "outboxAvailableAtColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_outbox'
      AND column_name = 'aggregate_type'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) AS "outboxAggregateTypeColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_outbox'
      AND column_name = 'aggregate_id'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) AS "outboxAggregateIdColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_outbox'
      AND column_name = 'dispatch_revision'
      AND data_type = 'bigint' AND is_nullable = 'YES'
  ) AS "outboxDispatchRevisionColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_dispatch_control'
      AND column_name = 'id'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) AS "dispatchControlIdColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_dispatch_control'
      AND column_name = 'paused'
      AND data_type = 'boolean' AND is_nullable = 'NO'
      AND column_default = 'true'
  ) AS "dispatchControlPausedColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_dispatch_control'
      AND column_name = 'revision'
      AND data_type = 'bigint' AND is_nullable = 'NO'
      AND column_default = '1'
  ) AS "dispatchControlRevisionColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_dispatch_control'
      AND column_name = 'remaining_claims'
      AND data_type = 'integer' AND is_nullable = 'YES'
  ) AS "dispatchControlRemainingClaimsColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_dispatch_control'
      AND column_name = 'probe_job_id'
      AND data_type = 'text' AND is_nullable = 'YES'
  ) AS "dispatchControlProbeJobIdColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'side_effect_dispatch_control'
      AND column_name = 'updated_at'
      AND data_type = 'timestamp with time zone' AND is_nullable = 'NO'
      AND column_default IN ('now()', 'CURRENT_TIMESTAMP')
  ) AS "dispatchControlUpdatedAtColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'payments'
      AND column_name = 'stripe_payment_intent_id'
      AND data_type = 'text' AND is_nullable = 'YES'
  ) AS "paymentStripeIntentIdColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'payments'
      AND column_name = 'client_secret'
      AND data_type = 'text' AND is_nullable = 'YES'
  ) AS "paymentClientSecretColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'payments'
      AND column_name = 'currency'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) AS "paymentCurrencyColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'payments'
      AND column_name = 'status'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) AS "paymentStatusColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'payments'
      AND column_name = 'capture_status'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) AS "paymentCaptureStatusColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users'
      AND column_name = 'wallet_binding_status'
      AND data_type = 'USER-DEFINED' AND udt_schema = current_schema()
      AND udt_name = 'WalletBindingStatus' AND is_nullable = 'NO'
  ) AS "walletBindingStatusColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users'
      AND column_name = 'wallet_binding_verified_at'
      AND data_type = 'timestamp without time zone' AND is_nullable = 'YES'
  ) AS "walletBindingVerifiedAtColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users'
      AND column_name = 'wallet_binding_version'
      AND data_type = 'integer' AND is_nullable = 'NO'
  ) AS "walletBindingVersionColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users'
      AND column_name = 'wallet_binding_fingerprint'
      AND data_type = 'text' AND is_nullable = 'YES'
  ) AS "walletBindingFingerprintColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sponsored_crypto_submissions'
      AND column_name = 'status'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) AS "sponsoredCryptoStatusColumn",
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sponsored_crypto_submissions'
      AND column_name = 'lease_expires_at'
      AND data_type = 'timestamp without time zone' AND is_nullable = 'YES'
  ) AS "sponsoredCryptoLeaseExpiresAtColumn",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'tickets'
      AND c.conname = 'tickets_ownership_route_shape_check'
      AND c.contype = 'c'
      AND c.convalidated
      AND md5(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]]+', '', 'g')) =
        'f88bf2c12a05c59caf1a7f00a3ec233e'
  ) AS "ticketOwnershipRouteShapeConstraint",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'tickets'
      AND c.conname = 'tickets_token_requires_ownership_route_check'
      AND c.contype = 'c'
      AND c.convalidated
      AND md5(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]]+', '', 'g')) =
        '2008aae4d08bf6f4019b9cc157ae6a9d'
  ) AS "ticketTokenRequiresRouteConstraint",
  EXISTS (
    SELECT 1
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'tickets'
      AND i.relname = 'tickets_ownership_contract_route_idx'
      AND x.indisvalid AND x.indisready
      AND NOT x.indisunique AND x.indnkeyatts = 3
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND pg_get_indexdef(x.indexrelid, 1, true) = 'ownership_chain_id'
      AND pg_get_indexdef(x.indexrelid, 2, true) = 'ownership_contract_address'
      AND pg_get_indexdef(x.indexrelid, 3, true) = 'ownership_contract_version'
  ) AS "ticketOwnershipRouteIndex",
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = current_schema()
      AND p.oid = to_regprocedure(
        format('%I.fanpass_validate_ownership_route_payload(jsonb)', current_schema())
      )
      AND p.prorettype = 'boolean'::regtype
      AND p.provolatile = 'i'
      AND md5(regexp_replace(p.prosrc, '[[:space:]]+', '', 'g')) =
        '16894a0b703bb6ddff8f5ec10f0edad2'
  ) AS "ownershipRoutePayloadValidationFunction",
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = current_schema()
      AND p.oid = to_regprocedure(
        format('%I.fanpass_validate_ownership_route_snapshot()', current_schema())
      )
      AND p.prorettype = 'trigger'::regtype
      AND p.provolatile = 'v'
      AND md5(regexp_replace(p.prosrc, '[[:space:]]+', '', 'g')) =
        '4f5907e060a9dc6d24013198f56c80a5'
  ) AS "ownershipRouteGuardFunction",
  EXISTS (
    SELECT 1
    FROM pg_trigger g
    JOIN pg_class t ON t.oid = g.tgrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'side_effect_outbox'
      AND g.tgname = 'side_effect_outbox_ownership_route_guard'
      AND NOT g.tgisinternal AND g.tgenabled IN ('O', 'A')
      AND g.tgtype = 23
      AND g.tgfoid = to_regprocedure(
        format('%I.fanpass_validate_ownership_route_snapshot()', current_schema())
      )
      AND g.tgqual IS NULL
      AND (
        SELECT array_agg(a.attname::text ORDER BY k.ordinality)
        FROM unnest(g.tgattr::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      ) = ARRAY['type', 'status', 'payload_json']::text[]
  ) AS "ownershipRouteGuardTrigger",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'users'
      AND c.conname = 'users_wallet_binding_provenance_check'
      AND c.contype = 'c'
      AND c.convalidated
      AND md5(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]]+', '', 'g')) =
        '0d472dad5bc177efb439ddc6a6e39db5'
  ) AS "walletBindingProvenanceConstraint",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'sponsored_crypto_submissions'
      AND c.conname = 'sponsored_crypto_submissions_status_check'
      AND c.contype = 'c'
      AND c.convalidated
      AND md5(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]]+', '', 'g')) =
        '7cd28d9d49c604032fa8e52c43687816'
  ) AS "sponsoredCryptoStatusConstraint",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'sponsored_crypto_submissions'
      AND c.conname = 'sponsored_crypto_submissions_payment_id_fkey'
      AND c.contype = 'f'
      AND c.convalidated
      AND md5(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]]+', '', 'g')) =
        '21b7580d3ed5ee47bc05dba265c86263'
  ) AS "sponsoredCryptoPaymentForeignKey",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'side_effect_dispatch_control'
      AND c.conname = 'side_effect_dispatch_control_pkey'
      AND c.contype = 'p' AND c.convalidated
      AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (id)'
  ) AS "dispatchControlPrimaryKey",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'side_effect_dispatch_control'
      AND c.conname = 'side_effect_dispatch_control_singleton_check'
      AND c.contype = 'c' AND c.convalidated
      AND pg_get_constraintdef(c.oid) = 'CHECK ((id = ''global''::text))'
  ) AS "dispatchControlSingletonConstraint",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'side_effect_dispatch_control'
      AND c.conname = 'side_effect_dispatch_control_revision_check'
      AND c.contype = 'c' AND c.convalidated
      AND pg_get_constraintdef(c.oid) = 'CHECK ((revision > 0))'
  ) AS "dispatchControlRevisionConstraint",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'side_effect_dispatch_control'
      AND c.conname = 'side_effect_dispatch_control_remaining_claims_check'
      AND c.contype = 'c' AND c.convalidated
      AND md5(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]]+', '', 'g')) =
        'a48448fe25f5f7c14d2e64e44a9199fd'
  ) AS "dispatchControlRemainingClaimsConstraint",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'side_effect_dispatch_control'
      AND c.conname = 'side_effect_dispatch_control_state_check'
      AND c.contype = 'c' AND c.convalidated
      AND md5(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]]+', '', 'g')) =
        'b34b227bd3b07bcbaed1c0a0db39a8f3'
  ) AS "dispatchControlStateConstraint",
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'side_effect_outbox'
      AND c.conname = 'side_effect_outbox_dispatch_revision_check'
      AND c.contype = 'c' AND c.convalidated
      AND md5(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]]+', '', 'g')) =
        '0170a9c1fc4ef060cd19e0a1325e8b0f'
  ) AS "outboxDispatchRevisionConstraint",
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = current_schema()
      AND p.oid = to_regprocedure(
        format('%I.fanpass_guard_side_effect_dispatch_claim()', current_schema())
      )
      AND p.prorettype = 'trigger'::regtype
      AND p.provolatile = 'v'
      AND md5(regexp_replace(p.prosrc, '[[:space:]]+', '', 'g')) =
        'ce0b7d56d305e026c28ffa0f69467ced'
  ) AS "dispatchClaimGuardFunction",
  EXISTS (
    SELECT 1
    FROM pg_trigger g
    JOIN pg_class t ON t.oid = g.tgrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'side_effect_outbox'
      AND g.tgname = 'side_effect_outbox_dispatch_guard'
      AND NOT g.tgisinternal AND g.tgenabled IN ('O', 'A')
      AND g.tgtype = 23
      AND g.tgfoid = to_regprocedure(
        format('%I.fanpass_guard_side_effect_dispatch_claim()', current_schema())
      )
      AND g.tgqual IS NULL
      AND (
        SELECT array_agg(a.attname::text ORDER BY k.ordinality)
        FROM unnest(g.tgattr::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      ) = ARRAY['status', 'dispatch_revision']::text[]
  ) AS "dispatchClaimGuardTrigger",
  EXISTS (
    SELECT 1
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'fan_task_submissions'
      AND i.relname = 'fan_task_submissions_user_id_task_id_key'
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indnkeyatts = 2 AND x.indpred IS NULL AND x.indexprs IS NULL
      AND pg_get_indexdef(x.indexrelid, 1, true) = 'user_id'
      AND pg_get_indexdef(x.indexrelid, 2, true) = 'task_id'
  ) AS "fanTaskSubmissionUniqueIndex",
  EXISTS (
    SELECT 1
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'side_effect_outbox'
      AND i.relname = 'side_effect_outbox_idempotency_key_key'
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indnkeyatts = 1 AND x.indpred IS NULL AND x.indexprs IS NULL
      AND pg_get_indexdef(x.indexrelid, 1, true) = 'idempotency_key'
  ) AS "outboxIdempotencyUniqueIndex",
  EXISTS (
    SELECT 1
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'side_effect_outbox'
      AND i.relname = 'side_effect_outbox_status_available_at_idx'
      AND x.indisvalid AND x.indisready
      AND NOT x.indisunique AND x.indnkeyatts = 2
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND pg_get_indexdef(x.indexrelid, 1, true) = 'status'
      AND pg_get_indexdef(x.indexrelid, 2, true) = 'available_at'
  ) AS "outboxStatusAvailabilityIndex"
`;

const AGGREGATE_QUERY = String.raw`
WITH ticket_rollup AS (
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE token_id IS NOT NULL)::bigint AS tokenized,
    COUNT(*) FILTER (
      WHERE ownership_contract_address IS NOT NULL
        AND lower(btrim(ownership_contract_address)) ~ '^0x[0-9a-f]{40}$'
        AND ownership_contract_address = lower(btrim(ownership_contract_address))
        AND ownership_chain_id IS NOT NULL
        AND btrim(ownership_chain_id) ~ '^[1-9][0-9]*$'
        AND ownership_contract_version = '${OWNERSHIP_CONTRACT_VERSION}'
    )::bigint AS route_complete,
    COUNT(*) FILTER (
      WHERE NOT COALESCE((
        (
          ownership_contract_address IS NULL
          AND ownership_chain_id IS NULL
          AND ownership_contract_version IS NULL
        ) OR (
          ownership_contract_address IS NOT NULL
          AND lower(btrim(ownership_contract_address)) ~ '^0x[0-9a-f]{40}$'
          AND ownership_contract_address = lower(btrim(ownership_contract_address))
          AND ownership_chain_id IS NOT NULL
          AND btrim(ownership_chain_id) ~ '^[1-9][0-9]*$'
          AND ownership_contract_version = '${OWNERSHIP_CONTRACT_VERSION}'
        )
      ), false)
    )::bigint AS route_shape_invalid,
    COUNT(*) FILTER (
      WHERE token_id IS NOT NULL
        AND NOT COALESCE((
          ownership_contract_address IS NOT NULL
          AND lower(btrim(ownership_contract_address)) ~ '^0x[0-9a-f]{40}$'
          AND ownership_contract_address = lower(btrim(ownership_contract_address))
          AND ownership_chain_id IS NOT NULL
          AND btrim(ownership_chain_id) ~ '^[1-9][0-9]*$'
          AND ownership_contract_version = '${OWNERSHIP_CONTRACT_VERSION}'
        ), false)
    )::bigint AS tokenized_route_incomplete
  FROM tickets
), ownership_jobs AS (
  SELECT
    status,
    type,
    payload_json,
    last_error,
    available_at,
    COALESCE(
      payload_json ->> 'localTicketId',
      payload_json ->> 'ticketId',
      CASE WHEN aggregate_type = 'ticket' THEN aggregate_id END
    ) AS ticket_id,
    fanpass_validate_ownership_route_payload(payload_json) AS route_snapshot_valid,
    payload_json ->> 'ownershipAdapter' AS ownership_adapter,
    payload_json -> 'contractRoute' ->> 'contractAddress' AS contract_address,
    payload_json -> 'contractRoute' ->> 'chainId' AS chain_id,
    payload_json -> 'contractRoute' ->> 'contractVersion' AS contract_version
  FROM side_effect_outbox
  WHERE type IN (
    'OWNERSHIP_ISSUE',
    'OWNERSHIP_ISSUE_RECEIPT_POLL',
    'OWNERSHIP_TRANSFER',
    'OWNERSHIP_RECEIPT_POLL',
    'OWNERSHIP_REDEEM',
    'OWNERSHIP_REDEEM_RECEIPT_POLL',
    'OWNERSHIP_SETTLEMENT_FINALIZE'
  )
), ownership_rollup AS (
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE status = 'PENDING')::bigint AS pending,
    COUNT(*) FILTER (WHERE status = 'RETRYING')::bigint AS retrying,
    COUNT(*) FILTER (WHERE status = 'PROCESSING')::bigint AS processing,
    COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed,
    COUNT(*) FILTER (WHERE status = 'DEAD')::bigint AS dead,
    COUNT(*) FILTER (WHERE status = 'COMPLETED')::bigint AS completed,
    COUNT(*) FILTER (
      WHERE status IN ('PENDING', 'RETRYING') AND available_at <= now()
    )::bigint AS runnable_backlog,
    COUNT(*) FILTER (
      WHERE status IS NULL OR status NOT IN (
        'PENDING', 'RETRYING', 'PROCESSING', 'FAILED', 'DEAD', 'COMPLETED'
      )
    )::bigint AS unknown_status,
    COUNT(*) FILTER (
      WHERE (status IS NULL OR status <> 'COMPLETED')
        AND (
          COALESCE(payload_json ->> '_fanpassOwnershipSubmissionStarted', 'false') = 'true'
          OR COALESCE(last_error, '') LIKE '%OWNERSHIP_SUBMISSION_STARTED%'
          OR COALESCE(last_error, '') LIKE '%OWNERSHIP_OUTCOME_AMBIGUOUS%'
        )
    )::bigint AS ambiguous_unresolved,
    COUNT(*) FILTER (
      WHERE status IN ('PENDING', 'RETRYING', 'PROCESSING')
        AND type IN ('OWNERSHIP_ISSUE', 'OWNERSHIP_ISSUE_RECEIPT_POLL')
    )::bigint AS active_issue,
    COUNT(*) FILTER (
      WHERE status IN ('PENDING', 'RETRYING', 'PROCESSING')
        AND type IN ('OWNERSHIP_ISSUE', 'OWNERSHIP_ISSUE_RECEIPT_POLL')
        AND NOT route_snapshot_valid
    )::bigint AS unsafe_issue_cutover,
    COUNT(*) FILTER (
      WHERE status IN ('PENDING', 'RETRYING', 'PROCESSING')
        AND COALESCE(ownership_adapter, '') <> '${EXPECTED_OWNERSHIP_ADAPTER}'
    )::bigint AS active_adapter_mismatch,
    COUNT(*) FILTER (
      WHERE status IN ('PENDING', 'RETRYING', 'PROCESSING')
        AND NOT route_snapshot_valid
    )::bigint AS active_route_invalid,
    COUNT(*) FILTER (
      WHERE status IN ('PENDING', 'RETRYING', 'PROCESSING')
        AND route_snapshot_valid
        AND ownership_adapter <> 'mock'
        AND NOT EXISTS (
          SELECT 1
          FROM tickets AS ticket
          WHERE ticket.id = ownership_jobs.ticket_id
            AND ticket.ownership_contract_address = ownership_jobs.contract_address
            AND ticket.ownership_chain_id = ownership_jobs.chain_id
            AND ticket.ownership_contract_version = ownership_jobs.contract_version
        )
    )::bigint AS ticket_route_mismatch
  FROM ownership_jobs
), provider_rollup AS (
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (
      WHERE status IS NULL OR status <> 'COMPLETED'
    )::bigint AS unresolved,
    COUNT(*) FILTER (WHERE status = 'PROCESSING')::bigint AS processing,
    COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed,
    COUNT(*) FILTER (WHERE status = 'DEAD')::bigint AS dead,
    COUNT(*) FILTER (
      WHERE status IS NULL OR status NOT IN (
        'PENDING', 'RETRYING', 'PROCESSING', 'FAILED', 'DEAD', 'COMPLETED'
      )
    )::bigint AS unknown_status
  FROM side_effect_outbox
  WHERE left(type, 8) = 'PAYMENT_'
    OR type = 'ORDER_MATCH_AFTER_PAYMENT_AUTH'
), provider_incomplete_card_payments AS (
  SELECT
    payment.id,
    EXISTS (
      SELECT 1
      FROM side_effect_outbox AS intent_job
      WHERE intent_job.type = 'PAYMENT_INTENT_CREATE'
        AND intent_job.status IN ('PENDING', 'RETRYING', 'PROCESSING')
        AND intent_job.idempotency_key = 'payment-intent-create:' || payment.id
        AND intent_job.aggregate_type = 'payment'
        AND intent_job.aggregate_id = payment.id
        AND intent_job.payload_json ->> 'paymentId' = payment.id
    ) AS has_active_intent_job
  FROM payments AS payment
  WHERE lower(btrim(payment.currency)) <> 'usdc'
    AND (
      payment.stripe_payment_intent_id IS NULL OR
      btrim(payment.stripe_payment_intent_id) = '' OR
      payment.client_secret IS NULL OR
      btrim(payment.client_secret) = '' OR
      (
        payment.status = 'PENDING' AND
        payment.capture_status = 'NOT_CAPTURED'
      )
    )
), provider_incomplete_card_payment_rollup AS (
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE NOT has_active_intent_job)::bigint AS without_active_intent_job
  FROM provider_incomplete_card_payments
), sponsored_rollup AS (
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (
      WHERE status IN ('SUBMITTING', 'RETRYABLE', 'PROVIDER_ACCEPTED', 'HASH_AVAILABLE')
    )::bigint AS nonterminal,
    COUNT(*) FILTER (WHERE status = 'AMBIGUOUS')::bigint AS ambiguous,
    COUNT(*) FILTER (WHERE status = 'COMPENSATION_REQUIRED')::bigint AS compensation_required,
    COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed,
    COUNT(*) FILTER (
      WHERE lease_expires_at IS NOT NULL AND lease_expires_at <= now()
    )::bigint AS expired_lease,
    COUNT(*) FILTER (
      WHERE status IS NULL OR status NOT IN (
        'SUBMITTING', 'RETRYABLE', 'PROVIDER_ACCEPTED', 'HASH_AVAILABLE',
        'CONFIRMED', 'FAILED', 'COMPENSATION_REQUIRED', 'AMBIGUOUS'
      )
    )::bigint AS unknown_status
  FROM sponsored_crypto_submissions
), outbox_safety_rollup AS (
  SELECT
    COUNT(*) FILTER (
      WHERE status IS NULL OR status NOT IN (
        'PENDING', 'RETRYING', 'PROCESSING', 'FAILED', 'DEAD', 'COMPLETED'
      )
    )::bigint AS unknown_status,
    COUNT(*) FILTER (
      WHERE (status IS NULL OR status <> 'COMPLETED')
        AND (
          type IS NULL OR type NOT IN (
            ${KNOWN_SIDE_EFFECT_TYPE_SQL}
          )
        )
    )::bigint AS unresolved_unknown_type,
    COUNT(*) FILTER (
      WHERE status = 'PROCESSING'
        AND (
          type IS NULL OR type NOT IN (
            ${KNOWN_SIDE_EFFECT_TYPE_SQL}
          )
        )
    )::bigint AS processing_unknown_type
  FROM side_effect_outbox
), dispatch_control_rollup AS (
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (
      WHERE id = 'global'
        AND paused = true
        AND revision > 0
        AND remaining_claims IS NULL
        AND probe_job_id IS NULL
    )::bigint AS paused_ready,
    COUNT(*) FILTER (WHERE paused = false)::bigint AS unpaused,
    COUNT(*) FILTER (
      WHERE remaining_claims IS NOT NULL OR probe_job_id IS NOT NULL
    )::bigint AS probe_budget_active,
    COUNT(*) FILTER (
      WHERE id <> 'global' OR revision <= 0 OR
        remaining_claims < 0 OR
        (remaining_claims IS NULL AND probe_job_id IS NOT NULL) OR
        (
          remaining_claims > 0 AND
          (paused = true OR remaining_claims <> 1 OR probe_job_id IS NULL)
        ) OR
        (
          remaining_claims = 0 AND
          (paused = false OR probe_job_id IS NOT NULL)
        )
    )::bigint AS invalid
  FROM side_effect_dispatch_control
)
SELECT
  ticket_rollup.total AS "ticketsTotal",
  ticket_rollup.tokenized AS "ticketsTokenized",
  ticket_rollup.route_complete AS "ticketsRouteComplete",
  ticket_rollup.route_shape_invalid AS "ticketsRouteShapeInvalid",
  ticket_rollup.tokenized_route_incomplete AS "ticketsTokenizedRouteIncomplete",
  ownership_rollup.total AS "ownershipJobsTotal",
  ownership_rollup.pending AS "ownershipJobsPending",
  ownership_rollup.retrying AS "ownershipJobsRetrying",
  ownership_rollup.processing AS "ownershipJobsProcessing",
  ownership_rollup.failed AS "ownershipJobsFailed",
  ownership_rollup.dead AS "ownershipJobsDead",
  ownership_rollup.completed AS "ownershipJobsCompleted",
  ownership_rollup.runnable_backlog AS "ownershipJobsRunnableBacklog",
  ownership_rollup.unknown_status AS "ownershipJobsUnknownStatus",
  ownership_rollup.ambiguous_unresolved AS "ownershipJobsAmbiguousUnresolved",
  ownership_rollup.active_issue AS "ownershipJobsActiveIssue",
  ownership_rollup.unsafe_issue_cutover AS "ownershipJobsUnsafeIssueCutover",
  ownership_rollup.active_adapter_mismatch AS "ownershipJobsActiveAdapterMismatch",
  ownership_rollup.active_route_invalid AS "ownershipJobsActiveRouteInvalid",
  ownership_rollup.ticket_route_mismatch AS "ownershipJobsTicketRouteMismatch",
  provider_rollup.total AS "providerJobsTotal",
  provider_rollup.unresolved AS "providerJobsUnresolved",
  provider_rollup.processing AS "providerJobsProcessing",
  provider_rollup.failed AS "providerJobsFailed",
  provider_rollup.dead AS "providerJobsDead",
  provider_rollup.unknown_status AS "providerJobsUnknownStatus",
  provider_incomplete_card_payment_rollup.total AS "providerIncompleteCardPaymentsTotal",
  provider_incomplete_card_payment_rollup.without_active_intent_job AS "providerIncompleteCardPaymentsWithoutActiveIntentJob",
  sponsored_rollup.total AS "sponsoredCryptoSubmissionsTotal",
  sponsored_rollup.nonterminal AS "sponsoredCryptoSubmissionsNonterminal",
  sponsored_rollup.ambiguous AS "sponsoredCryptoSubmissionsAmbiguous",
  sponsored_rollup.compensation_required AS "sponsoredCryptoSubmissionsCompensationRequired",
  sponsored_rollup.failed AS "sponsoredCryptoSubmissionsFailed",
  sponsored_rollup.expired_lease AS "sponsoredCryptoSubmissionsExpiredLease",
  sponsored_rollup.unknown_status AS "sponsoredCryptoSubmissionsUnknownStatus",
  outbox_safety_rollup.unknown_status AS "outboxJobsUnknownStatus",
  outbox_safety_rollup.unresolved_unknown_type AS "outboxJobsUnrecognizedTypeUnresolved",
  outbox_safety_rollup.processing_unknown_type AS "outboxJobsUnrecognizedTypeProcessing",
  dispatch_control_rollup.total AS "dispatchControlRows",
  dispatch_control_rollup.paused_ready AS "dispatchControlPausedReadyRows",
  dispatch_control_rollup.unpaused AS "dispatchControlUnpausedRows",
  dispatch_control_rollup.probe_budget_active AS "dispatchControlProbeBudgetActiveRows",
  dispatch_control_rollup.invalid AS "dispatchControlInvalidRows"
FROM ticket_rollup
CROSS JOIN ownership_rollup
CROSS JOIN provider_rollup
CROSS JOIN provider_incomplete_card_payment_rollup
CROSS JOIN sponsored_rollup
CROSS JOIN outbox_safety_rollup
CROSS JOIN dispatch_control_rollup
`;

const REQUIRED_SCHEMA_CHECKS = Object.freeze([
  "transactionReadOnly",
  "ticketsTable",
  "sideEffectOutboxTable",
  "usersTable",
  "paymentsTable",
  "sponsoredCryptoSubmissionsTable",
  "sideEffectDispatchControlTable",
  "ticketTokenIdColumn",
  "ticketOwnershipContractAddressColumn",
  "ticketOwnershipChainIdColumn",
  "ticketOwnershipContractVersionColumn",
  "outboxTypeColumn",
  "outboxStatusColumn",
  "outboxPayloadColumn",
  "outboxLastErrorColumn",
  "outboxAvailableAtColumn",
  "outboxAggregateTypeColumn",
  "outboxAggregateIdColumn",
  "outboxDispatchRevisionColumn",
  "dispatchControlIdColumn",
  "dispatchControlPausedColumn",
  "dispatchControlRevisionColumn",
  "dispatchControlRemainingClaimsColumn",
  "dispatchControlProbeJobIdColumn",
  "dispatchControlUpdatedAtColumn",
  "paymentStripeIntentIdColumn",
  "paymentClientSecretColumn",
  "paymentCurrencyColumn",
  "paymentStatusColumn",
  "paymentCaptureStatusColumn",
  "walletBindingStatusColumn",
  "walletBindingVerifiedAtColumn",
  "walletBindingVersionColumn",
  "walletBindingFingerprintColumn",
  "sponsoredCryptoStatusColumn",
  "sponsoredCryptoLeaseExpiresAtColumn",
  "ticketOwnershipRouteShapeConstraint",
  "ticketTokenRequiresRouteConstraint",
  "ticketOwnershipRouteIndex",
  "ownershipRoutePayloadValidationFunction",
  "ownershipRouteGuardFunction",
  "ownershipRouteGuardTrigger",
  "walletBindingProvenanceConstraint",
  "sponsoredCryptoStatusConstraint",
  "sponsoredCryptoPaymentForeignKey",
  "dispatchControlPrimaryKey",
  "dispatchControlSingletonConstraint",
  "dispatchControlRevisionConstraint",
  "dispatchControlRemainingClaimsConstraint",
  "dispatchControlStateConstraint",
  "outboxDispatchRevisionConstraint",
  "dispatchClaimGuardFunction",
  "dispatchClaimGuardTrigger",
  "fanTaskSubmissionUniqueIndex",
  "outboxIdempotencyUniqueIndex",
  "outboxStatusAvailabilityIndex",
]);

const DATA_QUERY_PREREQUISITES = Object.freeze([
  "transactionReadOnly",
  "ticketsTable",
  "sideEffectOutboxTable",
  "paymentsTable",
  "ticketTokenIdColumn",
  "ticketOwnershipContractAddressColumn",
  "ticketOwnershipChainIdColumn",
  "ticketOwnershipContractVersionColumn",
  "outboxTypeColumn",
  "outboxStatusColumn",
  "outboxPayloadColumn",
  "outboxLastErrorColumn",
  "outboxAvailableAtColumn",
  "outboxAggregateTypeColumn",
  "outboxAggregateIdColumn",
  "sideEffectDispatchControlTable",
  "dispatchControlIdColumn",
  "dispatchControlPausedColumn",
  "dispatchControlRevisionColumn",
  "dispatchControlRemainingClaimsColumn",
  "dispatchControlProbeJobIdColumn",
  "paymentStripeIntentIdColumn",
  "paymentClientSecretColumn",
  "paymentCurrencyColumn",
  "paymentStatusColumn",
  "paymentCaptureStatusColumn",
  "sponsoredCryptoSubmissionsTable",
  "sponsoredCryptoStatusColumn",
  "sponsoredCryptoLeaseExpiresAtColumn",
  "ownershipRoutePayloadValidationFunction",
]);

const COUNT_KEYS = Object.freeze([
  "ticketsTotal",
  "ticketsTokenized",
  "ticketsRouteComplete",
  "ticketsRouteShapeInvalid",
  "ticketsTokenizedRouteIncomplete",
  "ownershipJobsTotal",
  "ownershipJobsPending",
  "ownershipJobsRetrying",
  "ownershipJobsProcessing",
  "ownershipJobsFailed",
  "ownershipJobsDead",
  "ownershipJobsCompleted",
  "ownershipJobsRunnableBacklog",
  "ownershipJobsUnknownStatus",
  "ownershipJobsAmbiguousUnresolved",
  "ownershipJobsActiveIssue",
  "ownershipJobsUnsafeIssueCutover",
  "ownershipJobsActiveAdapterMismatch",
  "ownershipJobsActiveRouteInvalid",
  "ownershipJobsTicketRouteMismatch",
  "providerJobsTotal",
  "providerJobsUnresolved",
  "providerJobsProcessing",
  "providerJobsFailed",
  "providerJobsDead",
  "providerJobsUnknownStatus",
  "providerIncompleteCardPaymentsTotal",
  "providerIncompleteCardPaymentsWithoutActiveIntentJob",
  "sponsoredCryptoSubmissionsTotal",
  "sponsoredCryptoSubmissionsNonterminal",
  "sponsoredCryptoSubmissionsAmbiguous",
  "sponsoredCryptoSubmissionsCompensationRequired",
  "sponsoredCryptoSubmissionsFailed",
  "sponsoredCryptoSubmissionsExpiredLease",
  "sponsoredCryptoSubmissionsUnknownStatus",
  "outboxJobsUnknownStatus",
  "outboxJobsUnrecognizedTypeUnresolved",
  "outboxJobsUnrecognizedTypeProcessing",
  "dispatchControlRows",
  "dispatchControlPausedReadyRows",
  "dispatchControlUnpausedRows",
  "dispatchControlProbeBudgetActiveRows",
  "dispatchControlInvalidRows",
]);

async function collectReadOnlySnapshot(prisma) {
  if (!prisma || typeof prisma.$transaction !== "function") {
    throw new Error("PREFLIGHT_DATABASE_CLIENT_UNAVAILABLE");
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15000ms'");

      const schemaRows = await tx.$queryRawUnsafe(SCHEMA_QUERY);
      const schema = requireSingleRow(
        schemaRows,
        "PREFLIGHT_SCHEMA_QUERY_INVALID",
      );
      const canReadAggregates = DATA_QUERY_PREREQUISITES.every(
        (key) => schema[key] === true,
      );
      if (!canReadAggregates) {
        return { schema, aggregates: null };
      }

      const aggregateRows = await tx.$queryRawUnsafe(AGGREGATE_QUERY);
      const aggregates = requireSingleRow(
        aggregateRows,
        "PREFLIGHT_AGGREGATE_QUERY_INVALID",
      );
      return { schema, aggregates };
    },
    { maxWait: 5_000, timeout: 30_000 },
  );
}

async function collectReadOnlyDatabaseIdentity(prisma) {
  if (!prisma || typeof prisma.$transaction !== "function") {
    throw new Error("PREFLIGHT_DATABASE_CLIENT_UNAVAILABLE");
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15000ms'");
      const identityRows = await tx.$queryRawUnsafe(IDENTITY_QUERY);
      return requireSingleRow(identityRows, "PREFLIGHT_IDENTITY_QUERY_INVALID");
    },
    { maxWait: 5_000, timeout: 30_000 },
  );
}

function evaluateIdentityOnlySnapshot(snapshot, env = {}) {
  const databaseIdentity = evaluateDatabaseIdentity(
    env,
    snapshot?.databaseName,
    snapshot?.databaseUser,
    snapshot?.databaseSchema,
    snapshot?.databaseSessionUser,
  );
  const readOnlyTransaction = snapshot?.transactionReadOnly === true;
  const blockers = [];
  if (databaseIdentity.blocker) {
    blockers.push(databaseIdentity.blocker);
  }
  if (!readOnlyTransaction) {
    blockers.push("DATABASE_IDENTITY_TRANSACTION_NOT_READ_ONLY");
  }

  return {
    version: PREFLIGHT_VERSION,
    ok: blockers.length === 0,
    mode: "database-identity-only",
    redaction: {
      databaseUrlRedacted: true,
      databaseIdentityDigestRedacted: true,
      databaseNameRedacted: true,
      databaseUserRedacted: true,
      databaseSchemaRedacted: true,
      databaseSessionUserRedacted: true,
    },
    databaseIdentity: databaseIdentity.public,
    readOnlyTransaction,
    blockers: [...new Set(blockers)].sort(),
  };
}

function evaluateSnapshot(snapshot, env = {}) {
  const databaseIdentity = evaluateDatabaseIdentity(
    env,
    snapshot?.schema?.databaseName,
    snapshot?.schema?.databaseUser,
    snapshot?.schema?.databaseSchema,
    snapshot?.schema?.databaseSessionUser,
  );
  const schema = normalizeSchema(snapshot?.schema);
  const counts = normalizeCounts(snapshot?.aggregates);
  const configuration = evaluateConfiguration(env, counts);
  const blockers = [];

  for (const key of REQUIRED_SCHEMA_CHECKS) {
    if (schema[key] !== true) {
      blockers.push(`SCHEMA_${camelToUpperSnake(key)}_MISSING`);
    }
  }

  if (databaseIdentity.blocker) {
    blockers.push(databaseIdentity.blocker);
  }

  if (!counts) {
    blockers.push("AGGREGATE_STATE_UNAVAILABLE");
  } else {
    addCountBlocker(blockers, counts, "ticketsRouteShapeInvalid");
    addCountBlocker(blockers, counts, "ticketsTokenizedRouteIncomplete");
    addCountBlocker(blockers, counts, "ownershipJobsPending");
    addCountBlocker(blockers, counts, "ownershipJobsRetrying");
    addCountBlocker(blockers, counts, "ownershipJobsProcessing");
    addCountBlocker(blockers, counts, "ownershipJobsFailed");
    addCountBlocker(blockers, counts, "ownershipJobsDead");
    addCountBlocker(blockers, counts, "ownershipJobsUnknownStatus");
    addCountBlocker(blockers, counts, "ownershipJobsAmbiguousUnresolved");
    addCountBlocker(blockers, counts, "ownershipJobsActiveIssue");
    addCountBlocker(blockers, counts, "ownershipJobsUnsafeIssueCutover");
    addCountBlocker(blockers, counts, "ownershipJobsActiveAdapterMismatch");
    addCountBlocker(blockers, counts, "ownershipJobsActiveRouteInvalid");
    addCountBlocker(blockers, counts, "ownershipJobsTicketRouteMismatch");
    addCountBlocker(blockers, counts, "providerJobsUnresolved");
    addCountBlocker(blockers, counts, "providerJobsProcessing");
    addCountBlocker(blockers, counts, "providerJobsFailed");
    addCountBlocker(blockers, counts, "providerJobsDead");
    addCountBlocker(blockers, counts, "providerJobsUnknownStatus");
    addCountBlocker(
      blockers,
      counts,
      "providerIncompleteCardPaymentsWithoutActiveIntentJob",
    );
    addCountBlocker(blockers, counts, "sponsoredCryptoSubmissionsNonterminal");
    addCountBlocker(blockers, counts, "sponsoredCryptoSubmissionsAmbiguous");
    addCountBlocker(
      blockers,
      counts,
      "sponsoredCryptoSubmissionsCompensationRequired",
    );
    addCountBlocker(blockers, counts, "sponsoredCryptoSubmissionsFailed");
    addCountBlocker(blockers, counts, "sponsoredCryptoSubmissionsExpiredLease");
    addCountBlocker(
      blockers,
      counts,
      "sponsoredCryptoSubmissionsUnknownStatus",
    );
    addCountBlocker(blockers, counts, "outboxJobsUnknownStatus");
    addCountBlocker(blockers, counts, "outboxJobsUnrecognizedTypeUnresolved");
    addCountBlocker(blockers, counts, "outboxJobsUnrecognizedTypeProcessing");
    if (counts.dispatchControlRows !== 1) {
      blockers.push("DISPATCH_CONTROL_SINGLETON_INVALID");
    }
    if (counts.dispatchControlPausedReadyRows !== 1) {
      blockers.push("DISPATCH_CONTROL_NOT_PAUSED_READY");
    }
    addCountBlocker(blockers, counts, "dispatchControlUnpausedRows");
    addCountBlocker(blockers, counts, "dispatchControlProbeBudgetActiveRows");
    addCountBlocker(blockers, counts, "dispatchControlInvalidRows");
  }

  if (configuration.sideEffectWorker !== "disabled") {
    blockers.push("SIDE_EFFECT_WORKER_NOT_EXPLICITLY_DISABLED");
  }
  if (configuration.chainProofSync !== "enabled") {
    blockers.push("CHAIN_PROOF_SYNC_NOT_EXPLICITLY_ENABLED");
  }
  if (configuration.asyncOwnershipSettlement !== "enabled") {
    blockers.push("ASYNC_OWNERSHIP_SETTLEMENT_NOT_EXPLICITLY_ENABLED");
  }
  if (configuration.ownershipAdapter !== EXPECTED_OWNERSHIP_ADAPTER) {
    blockers.push("STAGING_OWNERSHIP_ADAPTER_NOT_PRIVY");
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  const schemaReady = REQUIRED_SCHEMA_CHECKS.every(
    (key) => schema[key] === true,
  );
  const routeReady = Boolean(
    counts &&
    counts.ticketsRouteShapeInvalid === 0 &&
    counts.ticketsTokenizedRouteIncomplete === 0 &&
    counts.ownershipJobsActiveAdapterMismatch === 0 &&
    counts.ownershipJobsActiveRouteInvalid === 0 &&
    counts.ownershipJobsTicketRouteMismatch === 0,
  );
  const databaseDispatchPaused = Boolean(
    counts &&
    counts.dispatchControlRows === 1 &&
    counts.dispatchControlPausedReadyRows === 1 &&
    counts.dispatchControlUnpausedRows === 0 &&
    counts.dispatchControlProbeBudgetActiveRows === 0 &&
    counts.dispatchControlInvalidRows === 0 &&
    schema.dispatchClaimGuardFunction === true &&
    schema.dispatchClaimGuardTrigger === true,
  );

  return {
    version: PREFLIGHT_VERSION,
    ok: uniqueBlockers.length === 0,
    mode: "database-read-only",
    redaction: {
      databaseUrlRedacted: true,
      databaseIdentityDigestRedacted: true,
      recordIdentifiersExcluded: true,
      walletAndPaymentDetailsExcluded: true,
    },
    configuration,
    databaseIdentity: databaseIdentity.public,
    schema: {
      ready: schemaReady,
      checks: schema,
    },
    counts,
    ownershipRoute: {
      ready: routeReady,
      expectedAdapter: EXPECTED_OWNERSHIP_ADAPTER,
      expectedContractVersion: OWNERSHIP_CONTRACT_VERSION,
      legacyBackfillConfigurationReady:
        configuration.legacyRoute.readyForBackfill,
    },
    worker: {
      preflightProcessConfiguredDisabled:
        configuration.sideEffectWorker === "disabled",
      databaseDispatchPaused,
      dispatchClaimsBlockedAtDatabase: databaseDispatchPaused,
      shouldRemainDisabled: true,
      safeForControlledEnable: false,
      externalRuntimeProofRequired: !databaseDispatchPaused,
    },
    blockers: uniqueBlockers,
  };
}

function evaluateConfiguration(env, counts) {
  const worker = canonicalBooleanState(env.FANPASS_SIDE_EFFECT_WORKER_ENABLED);
  const proofSync = canonicalBooleanState(env.FANPASS_CHAIN_PROOF_SYNC_OUTBOX);
  const asyncOwnershipSettlement = canonicalBooleanState(
    env.FANPASS_ASYNC_OWNERSHIP_SETTLEMENT,
  );
  const adapter = rawString(env.OWNERSHIP_ADAPTER);
  const legacyAdapter = trimmedString(env.FANPASS_LEGACY_OWNERSHIP_ADAPTER);
  const legacyAddress = trimmedString(
    env.FANPASS_LEGACY_TICKET_CONTRACT_ADDRESS,
  ).toLowerCase();
  const legacyChainId = trimmedString(env.FANPASS_LEGACY_TICKET_CHAIN_ID);
  const legacyAdapterValid = ["mock", "testnet", "privy"].includes(
    legacyAdapter,
  );
  const legacyContractAddressValid = /^0x[0-9a-f]{40}$/.test(legacyAddress);
  const legacyChainIdValid = /^[1-9][0-9]*$/.test(legacyChainId);
  const routeNeedsBackfill = counts
    ? counts.ticketsTokenizedRouteIncomplete > 0 ||
      counts.ownershipJobsActiveRouteInvalid > 0
    : null;
  const legacyReady =
    legacyAdapterValid &&
    (legacyAdapter === "mock"
      ? Boolean(counts && counts.ticketsTokenizedRouteIncomplete === 0)
      : legacyContractAddressValid && legacyChainIdValid);

  return {
    sideEffectWorker:
      worker === "false" ? "disabled" : worker === "true" ? "enabled" : worker,
    chainProofSync:
      proofSync === "true"
        ? "enabled"
        : proofSync === "false"
          ? "disabled"
          : proofSync,
    asyncOwnershipSettlement:
      asyncOwnershipSettlement === "true"
        ? "enabled"
        : asyncOwnershipSettlement === "false"
          ? "disabled"
          : asyncOwnershipSettlement,
    ownershipAdapter: ["mock", "testnet", "privy"].includes(adapter)
      ? adapter
      : adapter
        ? "invalid"
        : "unset",
    legacyRoute: {
      requiredForCurrentData: routeNeedsBackfill,
      adapter: legacyAdapterValid
        ? legacyAdapter
        : legacyAdapter
          ? "invalid"
          : "unset",
      contractAddressValid:
        legacyAdapter === "mock" ? null : legacyContractAddressValid,
      chainIdValid: legacyAdapter === "mock" ? null : legacyChainIdValid,
      readyForBackfill:
        routeNeedsBackfill === null
          ? false
          : !routeNeedsBackfill ||
            (counts.ownershipJobsUnsafeIssueCutover === 0 && legacyReady),
    },
  };
}

function deriveDatabaseIdentityDigest(databaseUrl) {
  const identity = canonicalDatabaseIdentity(databaseUrl);
  if (!identity) {
    return null;
  }
  return createHash("sha256")
    .update(JSON.stringify(identity), "utf8")
    .digest("hex");
}

function evaluateDatabaseIdentity(
  env,
  connectedDatabaseName,
  connectedDatabaseUser,
  connectedDatabaseSchema,
  connectedDatabaseSessionUser,
) {
  const expected = rawString(env?.[DATABASE_IDENTITY_ENV]);
  const expectedDigestConfigured = expected.length > 0;
  const expectedDigestValid = /^[0-9a-f]{64}$/.test(expected);
  const canonical = canonicalDatabaseIdentity(env?.DATABASE_URL);
  const targetConfigurationValid = canonical !== null;
  const actual = canonical
    ? createHash("sha256")
        .update(JSON.stringify(canonical), "utf8")
        .digest("hex")
    : null;
  const matched = Boolean(
    actual &&
    expectedDigestValid &&
    timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex")),
  );
  const databaseNameChecked = connectedDatabaseName !== undefined;
  const databaseUserChecked = connectedDatabaseUser !== undefined;
  const databaseSchemaChecked = connectedDatabaseSchema !== undefined;
  const databaseSessionUserChecked = connectedDatabaseSessionUser !== undefined;
  const databaseNameMatched = Boolean(
    canonical &&
    databaseNameChecked &&
    connectedDatabaseName === canonical.databaseName,
  );
  const databaseUserMatched = Boolean(
    canonical &&
    databaseUserChecked &&
    connectedDatabaseUser === canonical.databaseUser,
  );
  const databaseSchemaMatched = Boolean(
    canonical &&
    databaseSchemaChecked &&
    connectedDatabaseSchema === canonical.databaseSchema,
  );
  const databaseSessionUserMatched = Boolean(
    canonical &&
    databaseSessionUserChecked &&
    connectedDatabaseSessionUser === canonical.databaseUser,
  );

  let blocker = null;
  if (!expectedDigestConfigured) {
    blocker = "STAGING_DATABASE_IDENTITY_DIGEST_MISSING";
  } else if (!expectedDigestValid) {
    blocker = "STAGING_DATABASE_IDENTITY_DIGEST_INVALID";
  } else if (!targetConfigurationValid) {
    blocker = "DATABASE_URL_IDENTITY_INVALID";
  } else if (!matched) {
    blocker = "STAGING_DATABASE_IDENTITY_MISMATCH";
  } else if (databaseNameChecked && !databaseNameMatched) {
    blocker = "STAGING_DATABASE_NAME_MISMATCH";
  } else if (databaseUserChecked && !databaseUserMatched) {
    blocker = "STAGING_DATABASE_USER_MISMATCH";
  } else if (databaseSchemaChecked && !databaseSchemaMatched) {
    blocker = "STAGING_DATABASE_SCHEMA_MISMATCH";
  } else if (databaseSessionUserChecked && !databaseSessionUserMatched) {
    blocker = "STAGING_DATABASE_SESSION_USER_MISMATCH";
  }

  return {
    blocker,
    readyForQuery:
      expectedDigestConfigured &&
      expectedDigestValid &&
      targetConfigurationValid &&
      matched,
    public: {
      expectedDigestConfigured,
      expectedDigestValid,
      targetConfigurationValid,
      matched,
      databaseNameChecked,
      databaseNameMatched,
      databaseUserChecked,
      databaseUserMatched,
      databaseSchemaChecked,
      databaseSchemaMatched,
      databaseSessionUserChecked,
      databaseSessionUserMatched,
    },
  };
}

function canonicalDatabaseIdentity(databaseUrl) {
  const raw = rawString(databaseUrl).trim();
  if (!raw) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || "5432";
  const sslModes = parsed.searchParams.getAll("sslmode");
  const sslAccepts = parsed.searchParams.getAll("sslaccept");
  const queryParametersValid = [...parsed.searchParams.keys()].every(
    (key) => key === key.toLowerCase() && ALLOWED_DATABASE_URL_PARAMS.has(key),
  );
  const schemas = parsed.searchParams.getAll("schema");
  if (
    !hostname ||
    !/^[1-9][0-9]{0,4}$/.test(port) ||
    Number(port) > 65_535 ||
    sslModes.length !== 1 ||
    sslAccepts.length !== 1 ||
    !queryParametersValid ||
    schemas.length > 1
  ) {
    return null;
  }
  let databaseName;
  let databaseUser;
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1));
    databaseUser = decodeURIComponent(parsed.username);
  } catch {
    return null;
  }
  const sslMode = sslModes[0].trim().toLowerCase();
  const sslAccept = sslAccepts[0].trim().toLowerCase();
  const databaseSchema = schemas.length === 0 ? "public" : schemas[0].trim();
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !databaseUser ||
    databaseSchema !== "public" ||
    sslMode !== REQUIRED_STAGING_SSL_MODE ||
    sslAccept !== REQUIRED_STAGING_SSL_ACCEPT
  ) {
    return null;
  }
  return {
    version: DATABASE_IDENTITY_VERSION,
    scheme: "postgresql",
    hostname,
    port,
    databaseName,
    databaseUser,
    databaseSchema,
    sslMode,
    sslAccept,
  };
}

function normalizeSchema(input) {
  const schema = {};
  for (const key of REQUIRED_SCHEMA_CHECKS) {
    schema[key] = input?.[key] === true;
  }
  return schema;
}

function normalizeCounts(input) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const result = {};
  for (const key of COUNT_KEYS) {
    const value = normalizeCount(input[key]);
    if (value === null) {
      return null;
    }
    result[key] = value;
  }
  return result;
}

function normalizeCount(value) {
  if (typeof value === "bigint") {
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    return Number(value);
  }
  if (Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function canonicalBooleanState(value) {
  if (value === undefined || value === null || String(value) === "") {
    return "unset";
  }
  const normalized = String(value);
  return normalized === "true" || normalized === "false"
    ? normalized
    : "invalid";
}

function trimmedString(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function rawString(value) {
  return typeof value === "string" ? value : "";
}

function requireSingleRow(rows, code) {
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]) {
    throw new Error(code);
  }
  return rows[0];
}

function addCountBlocker(blockers, counts, key) {
  if (counts[key] > 0) {
    blockers.push(camelToUpperSnake(key));
  }
}

function camelToUpperSnake(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

module.exports = {
  AGGREGATE_QUERY,
  COUNT_KEYS,
  DATA_QUERY_PREREQUISITES,
  DATABASE_IDENTITY_ENV,
  DATABASE_IDENTITY_VERSION,
  EXPECTED_OWNERSHIP_ADAPTER,
  KNOWN_SIDE_EFFECT_TYPES,
  OWNERSHIP_CONTRACT_VERSION,
  PREFLIGHT_VERSION,
  REQUIRED_SCHEMA_CHECKS,
  SCHEMA_QUERY,
  IDENTITY_QUERY,
  collectReadOnlyDatabaseIdentity,
  collectReadOnlySnapshot,
  deriveDatabaseIdentityDigest,
  evaluateDatabaseIdentity,
  evaluateIdentityOnlySnapshot,
  evaluateSnapshot,
};
