-- Install this fail-closed fence in prisma:predeploy before Prisma schema push
-- or any route backfill. The explicit constraint convergence below also makes
-- this safe when Prisma created the control table during a fresh bootstrap.
BEGIN;

SELECT pg_advisory_xact_lock(
  hashtext('fanpass-schema-deploy-side-effect-dispatch-control-v1')
);

CREATE TABLE IF NOT EXISTS side_effect_dispatch_control (
  id text PRIMARY KEY,
  paused boolean NOT NULL DEFAULT true,
  revision bigint NOT NULL DEFAULT 1,
  remaining_claims integer,
  probe_job_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT side_effect_dispatch_control_singleton_check
    CHECK (id = 'global'),
  CONSTRAINT side_effect_dispatch_control_revision_check
    CHECK (revision > 0),
  CONSTRAINT side_effect_dispatch_control_remaining_claims_check
    CHECK (remaining_claims IS NULL OR remaining_claims >= 0),
  CONSTRAINT side_effect_dispatch_control_state_check
    CHECK (
      (remaining_claims IS NULL AND probe_job_id IS NULL) OR
      (
        paused = false AND
        remaining_claims = 1 AND
        probe_job_id IS NOT NULL
      ) OR (
        paused = true AND
        remaining_claims = 0 AND
        probe_job_id IS NULL
      )
    )
);

ALTER TABLE side_effect_dispatch_control
  ADD COLUMN IF NOT EXISTS probe_job_id text;

INSERT INTO side_effect_dispatch_control (
  id,
  paused,
  revision,
  remaining_claims,
  probe_job_id
)
VALUES ('global', true, 1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE side_effect_dispatch_control
SET
  paused = true,
  revision = revision + 1,
  remaining_claims = NULL,
  probe_job_id = NULL,
  updated_at = now()
WHERE id = 'global';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'side_effect_dispatch_control_singleton_check'
      AND conrelid = 'side_effect_dispatch_control'::regclass
  ) THEN
    ALTER TABLE side_effect_dispatch_control
      ADD CONSTRAINT side_effect_dispatch_control_singleton_check
      CHECK (id = 'global');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'side_effect_dispatch_control_revision_check'
      AND conrelid = 'side_effect_dispatch_control'::regclass
  ) THEN
    ALTER TABLE side_effect_dispatch_control
      ADD CONSTRAINT side_effect_dispatch_control_revision_check
      CHECK (revision > 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'side_effect_dispatch_control_remaining_claims_check'
      AND conrelid = 'side_effect_dispatch_control'::regclass
  ) THEN
    ALTER TABLE side_effect_dispatch_control
      ADD CONSTRAINT side_effect_dispatch_control_remaining_claims_check
      CHECK (remaining_claims IS NULL OR remaining_claims >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'side_effect_dispatch_control_state_check'
      AND conrelid = 'side_effect_dispatch_control'::regclass
  ) THEN
    ALTER TABLE side_effect_dispatch_control
      ADD CONSTRAINT side_effect_dispatch_control_state_check
      CHECK (
        (remaining_claims IS NULL AND probe_job_id IS NULL) OR
        (
          paused = false AND
          remaining_claims = 1 AND
          probe_job_id IS NOT NULL
        ) OR (
          paused = true AND
          remaining_claims = 0 AND
          probe_job_id IS NULL
        )
      );
  END IF;
END
$$;

ALTER TABLE side_effect_outbox
  ADD COLUMN IF NOT EXISTS dispatch_revision bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'side_effect_outbox_dispatch_revision_check'
      AND conrelid = 'side_effect_outbox'::regclass
  ) THEN
    ALTER TABLE side_effect_outbox
      ADD CONSTRAINT side_effect_outbox_dispatch_revision_check
      CHECK (dispatch_revision IS NULL OR dispatch_revision > 0) NOT VALID;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION fanpass_guard_side_effect_dispatch_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  dispatch_control side_effect_dispatch_control%ROWTYPE;
BEGIN
  IF NEW.status <> 'PROCESSING' THEN
    NEW.dispatch_revision := NULL;
    RETURN NEW;
  END IF;

  SELECT *
  INTO dispatch_control
  FROM side_effect_dispatch_control
  WHERE id = 'global'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'fanpass_side_effect_dispatch_blocked: control row is missing';
  END IF;

  IF dispatch_control.paused THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'fanpass_side_effect_dispatch_blocked: dispatch is paused';
  END IF;

  IF NEW.dispatch_revision IS NULL OR
     NEW.dispatch_revision <> dispatch_control.revision THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'fanpass_side_effect_dispatch_blocked: stale dispatch revision';
  END IF;

  IF dispatch_control.remaining_claims IS NOT NULL THEN
    IF dispatch_control.remaining_claims < 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'fanpass_side_effect_dispatch_blocked: probe claim budget exhausted';
    END IF;

    IF dispatch_control.probe_job_id IS NULL OR
       NEW.id <> dispatch_control.probe_job_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'fanpass_side_effect_dispatch_blocked: job is not the bound controlled probe';
    END IF;

    UPDATE side_effect_dispatch_control
    SET
      remaining_claims = remaining_claims - 1,
      paused = remaining_claims = 1,
      probe_job_id = CASE WHEN remaining_claims = 1 THEN NULL ELSE probe_job_id END,
      updated_at = now()
    WHERE id = 'global';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS side_effect_outbox_dispatch_guard
  ON side_effect_outbox;
CREATE TRIGGER side_effect_outbox_dispatch_guard
BEFORE INSERT OR UPDATE OF status, dispatch_revision
ON side_effect_outbox
FOR EACH ROW
EXECUTE FUNCTION fanpass_guard_side_effect_dispatch_claim();

ALTER TABLE side_effect_outbox
  VALIDATE CONSTRAINT side_effect_outbox_dispatch_revision_check;

COMMIT;
