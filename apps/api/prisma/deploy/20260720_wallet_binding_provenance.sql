BEGIN;

SELECT pg_advisory_xact_lock(
  hashtext('fanpass-schema-deploy-wallet-binding-provenance-v1')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'users'
      AND column_name = 'wallet_binding_status'
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'wallet binding provenance columns are missing',
      HINT = 'Run the reviewed Prisma schema push before this postdeploy guard. Do not reorder wallet provenance validation ahead of schema creation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM users
    WHERE wallet_binding_status = 'VERIFIED'
      AND (
        privy_id IS NULL OR btrim(privy_id) = '' OR
        privy_wallet_id IS NULL OR btrim(privy_wallet_id) = '' OR
        wallet_address IS NULL OR
          lower(btrim(wallet_address)) !~ '^0x[0-9a-f]{40}$' OR
        wallet_binding_verified_at IS NULL OR
        wallet_binding_version <= 0 OR
        wallet_binding_fingerprint IS NULL OR
          lower(btrim(wallet_binding_fingerprint)) !~ '^[0-9a-f]{64}$'
      )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'users contains an invalid VERIFIED wallet binding',
      HINT = 'Stop deployment. Never infer VERIFIED from legacy non-null wallet fields; repair each binding through an authoritative Privy lookup.';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_wallet_binding_provenance_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_wallet_binding_provenance_check
      CHECK (
        wallet_binding_version >= 0
        AND (
          wallet_binding_status <> 'VERIFIED'
          OR (
            privy_id IS NOT NULL AND btrim(privy_id) <> '' AND
            privy_wallet_id IS NOT NULL AND btrim(privy_wallet_id) <> '' AND
            wallet_address IS NOT NULL AND
              lower(btrim(wallet_address)) ~ '^0x[0-9a-f]{40}$' AND
            wallet_binding_verified_at IS NOT NULL AND
            wallet_binding_version > 0 AND
            wallet_binding_fingerprint IS NOT NULL AND
              lower(btrim(wallet_binding_fingerprint)) ~ '^[0-9a-f]{64}$'
          )
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS users_wallet_binding_status_idx
  ON users (wallet_binding_status);

COMMIT;
