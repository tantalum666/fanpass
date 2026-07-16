BEGIN;

SELECT pg_advisory_xact_lock(
  hashtext('fanpass-schema-deploy-fan-task-submission-uniqueness')
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM fan_task_submissions
    GROUP BY user_id, task_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'fan_task_submissions contains duplicate user/task pairs',
      HINT = 'Stop deployment and complete a reviewed, audited remediation before adding the unique constraint.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS fan_task_submissions_user_id_task_id_key
  ON fan_task_submissions (user_id, task_id);

COMMIT;
