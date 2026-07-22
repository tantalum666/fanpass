BEGIN;

SELECT pg_advisory_xact_lock(
  hashtext('fanpass-schema-deploy-ticket-ownership-route-v1')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'side_effect_outbox_ownership_route_guard'
      AND tgrelid = 'side_effect_outbox'::regclass
      AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'ownership route write guard trigger is missing or disabled',
      HINT = 'Run 20260720_ticket_ownership_route_enforcement.sql before backfill and validation.';
  END IF;

  IF EXISTS (
    SELECT 1
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
      AND status IN ('PENDING', 'RETRYING', 'PROCESSING')
      AND fanpass_validate_ownership_route_payload(payload_json) = false
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'active ownership side effects remain without a valid immutable route snapshot',
      HINT = 'Keep the worker disabled, repair or drain the listed jobs, and rerun the idempotent backfill.';
  END IF;
END
$$;

ALTER TABLE tickets
  VALIDATE CONSTRAINT tickets_ownership_route_shape_check;
ALTER TABLE tickets
  VALIDATE CONSTRAINT tickets_token_requires_ownership_route_check;

CREATE INDEX IF NOT EXISTS tickets_ownership_contract_route_idx
  ON tickets (
    ownership_chain_id,
    ownership_contract_address,
    ownership_contract_version
  );

COMMIT;
