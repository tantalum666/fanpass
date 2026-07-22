BEGIN;

SELECT pg_advisory_xact_lock(
  hashtext('fanpass-schema-deploy-ticket-ownership-route-v1')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'tickets'
      AND column_name = 'ownership_contract_address'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'tickets'
      AND column_name = 'ownership_chain_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'tickets'
      AND column_name = 'ownership_contract_version'
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'ticket ownership route columns are missing',
      HINT = 'Run the reviewed Prisma schema push before the ownership-route postdeploy steps.';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_ownership_route_shape_check'
      AND conrelid = 'tickets'::regclass
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_ownership_route_shape_check
      CHECK (
        (
          ownership_contract_address IS NULL AND
          ownership_chain_id IS NULL AND
          ownership_contract_version IS NULL
        ) OR (
          ownership_contract_address IS NOT NULL AND
          lower(btrim(ownership_contract_address)) ~ '^0x[0-9a-f]{40}$' AND
          ownership_contract_address = lower(btrim(ownership_contract_address)) AND
          ownership_chain_id IS NOT NULL AND
          btrim(ownership_chain_id) ~ '^[1-9][0-9]*$' AND
          ownership_contract_version = 'fanpass-ticket-v1'
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_token_requires_ownership_route_check'
      AND conrelid = 'tickets'::regclass
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_token_requires_ownership_route_check
      CHECK (
        token_id IS NULL OR (
          ownership_contract_address IS NOT NULL AND
          ownership_chain_id IS NOT NULL AND
          ownership_contract_version IS NOT NULL
        )
      ) NOT VALID;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION fanpass_validate_ownership_route_payload(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  adapter text;
  route jsonb;
BEGIN
  adapter := payload ->> 'ownershipAdapter';
  IF adapter IS NULL OR adapter NOT IN ('mock', 'testnet', 'privy') THEN
    RETURN false;
  END IF;

  IF adapter = 'mock' THEN
    RETURN true;
  END IF;

  route := payload -> 'contractRoute';
  RETURN route IS NOT NULL AND
    jsonb_typeof(route) = 'object' AND
    coalesce(lower(btrim(route ->> 'contractAddress')) ~ '^0x[0-9a-f]{40}$', false) AND
    coalesce(route ->> 'contractAddress' = lower(btrim(route ->> 'contractAddress')), false) AND
    coalesce(btrim(route ->> 'chainId') ~ '^[1-9][0-9]*$', false) AND
    coalesce(route ->> 'contractVersion' = 'fanpass-ticket-v1', false);
END
$$;

CREATE OR REPLACE FUNCTION fanpass_validate_ownership_route_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type NOT IN (
    'OWNERSHIP_ISSUE',
    'OWNERSHIP_ISSUE_RECEIPT_POLL',
    'OWNERSHIP_TRANSFER',
    'OWNERSHIP_RECEIPT_POLL',
    'OWNERSHIP_REDEEM',
    'OWNERSHIP_REDEEM_RECEIPT_POLL',
    'OWNERSHIP_SETTLEMENT_FINALIZE'
  ) OR NEW.status NOT IN ('PENDING', 'RETRYING', 'PROCESSING') THEN
    RETURN NEW;
  END IF;

  IF NOT fanpass_validate_ownership_route_payload(NEW.payload_json) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'active ownership side effect is missing a valid immutable adapter/contract route snapshot',
      HINT = 'Use the route-aware API or run the reviewed legacy ownership-route backfill; never fall back to the current global contract.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS side_effect_outbox_ownership_route_guard
  ON side_effect_outbox;
CREATE TRIGGER side_effect_outbox_ownership_route_guard
BEFORE INSERT OR UPDATE OF type, status, payload_json
ON side_effect_outbox
FOR EACH ROW
EXECUTE FUNCTION fanpass_validate_ownership_route_snapshot();

COMMIT;
