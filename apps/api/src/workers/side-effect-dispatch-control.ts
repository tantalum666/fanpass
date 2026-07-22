import { Prisma, PrismaClient } from "@prisma/client";

export const DISPATCH_RESUME_CONFIRMATION = "RESUME_FANPASS_SIDE_EFFECTS";

type DispatchAction = "status" | "pause" | "resume";

interface DispatchControlArguments {
  action: DispatchAction;
  confirmation: string | null;
  probeLimit: 1 | null;
}

interface DispatchAggregateRow {
  paused: boolean;
  revision: bigint;
  remainingClaims: number | null;
  processing: bigint;
  failed: bigint;
  dead: bigint;
  activeBacklog: bigint;
  claimableBacklog: bigint;
  unknownOutboxState: bigint;
  activeUnknownType: bigint;
  ownershipAmbiguous: bigint;
  activeOwnershipWrongAdapter: bigint;
  activeOwnershipInvalidRoute: bigint;
  activeOwnershipTicketRouteMismatch: bigint;
  providerUnresolved: bigint;
  providerUnknownState: bigint;
  sponsoredNonterminal: bigint;
  sponsoredAmbiguous: bigint;
  sponsoredCompensationRequired: bigint;
  sponsoredFailed: bigint;
  sponsoredExpiredLease: bigint;
  sponsoredUnknownState: bigint;
}

export interface DispatchControlSuccess {
  ok: true;
  action: DispatchAction;
  control: {
    paused: boolean;
    revision: string;
    remainingClaims: number | null;
  };
  counts: {
    processing: number;
    failed: number;
    dead: number;
    activeBacklog: number;
    claimableBacklog: number;
    unknownOutboxState: number;
    activeUnknownType: number;
    ownershipAmbiguous: number;
    activeOwnershipWrongAdapter: number;
    activeOwnershipInvalidRoute: number;
    activeOwnershipTicketRouteMismatch: number;
    providerUnresolved: number;
    providerUnknownState: number;
    sponsoredNonterminal: number;
    sponsoredAmbiguous: number;
    sponsoredCompensationRequired: number;
    sponsoredFailed: number;
    sponsoredExpiredLease: number;
    sponsoredUnknownState: number;
  };
}

export interface DispatchControlUnsafePause extends Omit<
  DispatchControlSuccess,
  "ok"
> {
  ok: false;
  error: {
    code: "PAUSED_WITH_UNRESOLVED_SIDE_EFFECTS";
    message: string;
  };
}

export type DispatchControlResult =
  DispatchControlSuccess | DispatchControlUnsafePause;

export type DispatchControlErrorCode =
  | "INVALID_ACTION"
  | "INVALID_OPTION"
  | "INVALID_PROBE_LIMIT"
  | "RESUME_OPTIONS_INVALID"
  | "RESUME_CONFIRMATION_REQUIRED"
  | "RESUME_BLOCKED_RISK_STATE"
  | "RESUME_BLOCKED_ACTIVE_BACKLOG"
  | "PROBE_REQUIRES_EXACT_JOB"
  | "CONTROL_ROW_MISSING"
  | "PAUSED_WITH_UNRESOLVED_SIDE_EFFECTS"
  | "DISPATCH_CONTROL_UNAVAILABLE";

export class SideEffectDispatchControlError extends Error {
  constructor(
    readonly code: DispatchControlErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SideEffectDispatchControlError";
  }
}

type DispatchControlWriter = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "$executeRaw"
>;

type DispatchControlClient = DispatchControlWriter & {
  $transaction<T>(
    callback: (writer: DispatchControlWriter) => Promise<T>,
  ): Promise<T>;
};

export function parseDispatchControlArguments(
  argv: string[],
): DispatchControlArguments {
  const [rawAction = "status", ...options] = argv;
  if (!(["status", "pause", "resume"] as string[]).includes(rawAction)) {
    throw controlError(
      "INVALID_ACTION",
      "Action must be one of: status, pause, resume",
    );
  }
  let confirmation: string | null = null;
  let probeLimit: 1 | null = null;
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option === "--confirm") {
      confirmation = options[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (option?.startsWith("--confirm=")) {
      confirmation = option.slice("--confirm=".length);
      continue;
    }
    if (option === "--probe-limit") {
      if (options[index + 1] !== "1") {
        throw controlError(
          "INVALID_PROBE_LIMIT",
          "Controlled probe limit must be exactly 1",
        );
      }
      probeLimit = 1;
      index += 1;
      continue;
    }
    if (option?.startsWith("--probe-limit=")) {
      if (option.slice("--probe-limit=".length) !== "1") {
        throw controlError(
          "INVALID_PROBE_LIMIT",
          "Controlled probe limit must be exactly 1",
        );
      }
      probeLimit = 1;
      continue;
    }
    throw controlError(
      "INVALID_OPTION",
      "Unknown side-effect dispatch control option",
    );
  }
  if (rawAction !== "resume" && (confirmation || probeLimit)) {
    throw controlError(
      "RESUME_OPTIONS_INVALID",
      "Resume options are only valid with the resume action",
    );
  }
  return {
    action: rawAction as DispatchAction,
    confirmation,
    probeLimit,
  };
}

export async function runSideEffectDispatchControl(
  prisma: DispatchControlClient,
  argv: string[],
): Promise<DispatchControlResult> {
  const input = parseDispatchControlArguments(argv);
  if (input.action === "status") {
    return formatResult("status", await readAggregate(prisma));
  }
  if (input.action === "pause") {
    await prisma.$transaction(async (tx) => {
      await requireControlRow(tx);
      await tx.$executeRaw`
        UPDATE side_effect_dispatch_control
        SET
          paused = true,
          revision = revision + 1,
          remaining_claims = NULL,
          probe_job_id = NULL,
          updated_at = now()
        WHERE id = 'global'
      `;
    });
    const aggregate = await readAggregate(prisma);
    const paused = formatResult("pause", aggregate);
    if (hasUnresolvedSideEffects(aggregate)) {
      return {
        ...paused,
        ok: false,
        error: {
          code: "PAUSED_WITH_UNRESOLVED_SIDE_EFFECTS",
          message:
            "Dispatch is paused, but unresolved or in-flight side effects require wait and recheck",
        },
      };
    }
    return paused;
  }

  if (input.confirmation !== DISPATCH_RESUME_CONFIRMATION) {
    throw controlError(
      "RESUME_CONFIRMATION_REQUIRED",
      `Resume requires --confirm ${DISPATCH_RESUME_CONFIRMATION}`,
    );
  }
  return prisma.$transaction(async (tx) => {
    await requireControlRow(tx);
    const before = await readAggregate(tx);
    assertSafeToResume(before, input.probeLimit);
    const probeJobId =
      input.probeLimit === 1 ? await selectExactProbeJobId(tx) : null;
    await tx.$executeRaw`
      UPDATE side_effect_dispatch_control
      SET
        paused = false,
        revision = revision + 1,
        remaining_claims = ${input.probeLimit},
        probe_job_id = ${probeJobId},
        updated_at = now()
      WHERE id = 'global'
    `;
    return formatResult("resume", await readAggregate(tx));
  });
}

async function selectExactProbeJobId(writer: DispatchControlWriter) {
  const rows = await writer.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM side_effect_outbox
    WHERE status IN ('PENDING', 'RETRYING')
      AND available_at <= now()
    ORDER BY available_at ASC, created_at ASC, id ASC
    FOR UPDATE
  `;
  if (rows.length !== 1) {
    throw controlError(
      "PROBE_REQUIRES_EXACT_JOB",
      "Controlled probe requires exactly one active and claimable job",
    );
  }
  return rows[0].id;
}

async function requireControlRow(writer: DispatchControlWriter) {
  const rows = await writer.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM side_effect_dispatch_control
    WHERE id = 'global'
    FOR UPDATE
  `;
  if (rows.length !== 1) {
    throw controlError(
      "CONTROL_ROW_MISSING",
      "Side-effect dispatch control row is missing",
    );
  }
}

async function readAggregate(
  writer: DispatchControlWriter,
): Promise<DispatchAggregateRow> {
  const [row] = await writer.$queryRaw<DispatchAggregateRow[]>`
    SELECT
      control.paused,
      control.revision,
      control.remaining_claims AS "remainingClaims",
      COUNT(job.id) FILTER (WHERE job.status = 'PROCESSING')::bigint AS processing,
      COUNT(job.id) FILTER (WHERE job.status = 'FAILED')::bigint AS failed,
      COUNT(job.id) FILTER (WHERE job.status = 'DEAD')::bigint AS dead,
      COUNT(job.id) FILTER (
        WHERE job.status IN ('PENDING', 'RETRYING')
      )::bigint AS "activeBacklog",
      COUNT(job.id) FILTER (
        WHERE job.status IN ('PENDING', 'RETRYING')
          AND job.available_at <= now()
      )::bigint AS "claimableBacklog",
      COUNT(job.id) FILTER (
        WHERE job.status IS NULL OR job.status NOT IN (
          'PENDING',
          'RETRYING',
          'PROCESSING',
          'COMPLETED',
          'FAILED',
          'DEAD'
        )
      )::bigint AS "unknownOutboxState",
      COUNT(job.id) FILTER (
        WHERE job.status IN ('PENDING', 'RETRYING', 'PROCESSING')
          AND job.type NOT IN (
            'OWNERSHIP_ISSUE',
            'OWNERSHIP_ISSUE_RECEIPT_POLL',
            'OWNERSHIP_TRANSFER',
            'OWNERSHIP_RECEIPT_POLL',
            'OWNERSHIP_REDEEM',
            'OWNERSHIP_REDEEM_RECEIPT_POLL',
            'OWNERSHIP_SETTLEMENT_FINALIZE',
            'PAYMENT_INTENT_CREATE',
            'PAYMENT_CAPTURE',
            'PAYMENT_CANCEL_AUTHORIZATION',
            'PAYMENT_REFUND',
            'PAYMENT_RECONCILE',
            'ORDER_MATCH_AFTER_PAYMENT_AUTH'
          )
      )::bigint AS "activeUnknownType",
      COUNT(job.id) FILTER (
        WHERE job.type LIKE 'OWNERSHIP_%'
          AND job.status <> 'COMPLETED'
          AND (
            coalesce(job.last_error, '') LIKE '%OWNERSHIP_OUTCOME_AMBIGUOUS%' OR
            coalesce(job.last_error, '') LIKE '%OWNERSHIP_SUBMISSION_STARTED%' OR
            coalesce(
              job.payload_json ->> '_fanpassOwnershipSubmissionStarted',
              'false'
            ) = 'true'
          )
      )::bigint AS "ownershipAmbiguous",
      COUNT(job.id) FILTER (
        WHERE job.type IN (
          'OWNERSHIP_ISSUE',
          'OWNERSHIP_ISSUE_RECEIPT_POLL',
          'OWNERSHIP_TRANSFER',
          'OWNERSHIP_RECEIPT_POLL',
          'OWNERSHIP_REDEEM',
          'OWNERSHIP_REDEEM_RECEIPT_POLL',
          'OWNERSHIP_SETTLEMENT_FINALIZE'
        )
          AND job.status IN ('PENDING', 'RETRYING', 'PROCESSING')
          AND coalesce(job.payload_json ->> 'ownershipAdapter', '') <> 'privy'
      )::bigint AS "activeOwnershipWrongAdapter",
      COUNT(job.id) FILTER (
        WHERE job.type IN (
          'OWNERSHIP_ISSUE',
          'OWNERSHIP_ISSUE_RECEIPT_POLL',
          'OWNERSHIP_TRANSFER',
          'OWNERSHIP_RECEIPT_POLL',
          'OWNERSHIP_REDEEM',
          'OWNERSHIP_REDEEM_RECEIPT_POLL',
          'OWNERSHIP_SETTLEMENT_FINALIZE'
        )
          AND job.status IN ('PENDING', 'RETRYING', 'PROCESSING')
          AND NOT fanpass_validate_ownership_route_payload(job.payload_json)
      )::bigint AS "activeOwnershipInvalidRoute",
      (
        SELECT COUNT(*)::bigint
        FROM side_effect_outbox AS ownership_job
        LEFT JOIN tickets AS ticket
          ON ticket.id = coalesce(
            ownership_job.payload_json ->> 'localTicketId',
            ownership_job.payload_json ->> 'ticketId',
            CASE
              WHEN ownership_job.aggregate_type = 'ticket'
              THEN ownership_job.aggregate_id
            END
          )
        WHERE ownership_job.type IN (
          'OWNERSHIP_ISSUE',
          'OWNERSHIP_ISSUE_RECEIPT_POLL',
          'OWNERSHIP_TRANSFER',
          'OWNERSHIP_RECEIPT_POLL',
          'OWNERSHIP_REDEEM',
          'OWNERSHIP_REDEEM_RECEIPT_POLL',
          'OWNERSHIP_SETTLEMENT_FINALIZE'
        )
          AND ownership_job.status IN ('PENDING', 'RETRYING', 'PROCESSING')
          AND (
            ticket.id IS NULL OR
            ticket.ownership_contract_address IS DISTINCT FROM
              ownership_job.payload_json -> 'contractRoute' ->> 'contractAddress' OR
            ticket.ownership_chain_id IS DISTINCT FROM
              ownership_job.payload_json -> 'contractRoute' ->> 'chainId' OR
            ticket.ownership_contract_version IS DISTINCT FROM
              ownership_job.payload_json -> 'contractRoute' ->> 'contractVersion'
          )
      ) AS "activeOwnershipTicketRouteMismatch",
      COUNT(job.id) FILTER (
        WHERE job.type IN (
          'PAYMENT_INTENT_CREATE',
          'PAYMENT_CAPTURE',
          'PAYMENT_CANCEL_AUTHORIZATION',
          'PAYMENT_REFUND',
          'PAYMENT_RECONCILE',
          'ORDER_MATCH_AFTER_PAYMENT_AUTH'
        )
          AND job.status IS DISTINCT FROM 'COMPLETED'
      )::bigint AS "providerUnresolved",
      COUNT(job.id) FILTER (
        WHERE job.type IN (
          'PAYMENT_INTENT_CREATE',
          'PAYMENT_CAPTURE',
          'PAYMENT_CANCEL_AUTHORIZATION',
          'PAYMENT_REFUND',
          'PAYMENT_RECONCILE',
          'ORDER_MATCH_AFTER_PAYMENT_AUTH'
        )
          AND (
            job.status IS NULL OR
            job.status NOT IN (
              'PENDING',
              'RETRYING',
              'PROCESSING',
              'COMPLETED',
              'FAILED',
              'DEAD'
            )
          )
      )::bigint AS "providerUnknownState",
      (
        SELECT COUNT(*)::bigint
        FROM sponsored_crypto_submissions
        WHERE status IN (
          'SUBMITTING',
          'RETRYABLE',
          'PROVIDER_ACCEPTED',
          'HASH_AVAILABLE'
        )
      ) AS "sponsoredNonterminal",
      (
        SELECT COUNT(*)::bigint
        FROM sponsored_crypto_submissions
        WHERE status = 'AMBIGUOUS'
      ) AS "sponsoredAmbiguous",
      (
        SELECT COUNT(*)::bigint
        FROM sponsored_crypto_submissions
        WHERE status = 'COMPENSATION_REQUIRED'
      ) AS "sponsoredCompensationRequired",
      (
        SELECT COUNT(*)::bigint
        FROM sponsored_crypto_submissions
        WHERE status = 'FAILED'
      ) AS "sponsoredFailed",
      (
        SELECT COUNT(*)::bigint
        FROM sponsored_crypto_submissions
        WHERE status IN (
          'SUBMITTING',
          'RETRYABLE',
          'PROVIDER_ACCEPTED',
          'HASH_AVAILABLE'
        )
          AND lease_owner IS NOT NULL
          AND (lease_expires_at IS NULL OR lease_expires_at <= now())
      ) AS "sponsoredExpiredLease",
      (
        SELECT COUNT(*)::bigint
        FROM sponsored_crypto_submissions
        WHERE status NOT IN (
          'SUBMITTING',
          'RETRYABLE',
          'PROVIDER_ACCEPTED',
          'HASH_AVAILABLE',
          'CONFIRMED',
          'FAILED',
          'COMPENSATION_REQUIRED',
          'AMBIGUOUS'
        )
      ) AS "sponsoredUnknownState"
    FROM side_effect_dispatch_control AS control
    LEFT JOIN side_effect_outbox AS job ON true
    WHERE control.id = 'global'
    GROUP BY
      control.paused,
      control.revision,
      control.remaining_claims
  `;
  if (!row) {
    throw controlError(
      "CONTROL_ROW_MISSING",
      "Side-effect dispatch control row is missing",
    );
  }
  return row;
}

function assertSafeToResume(
  aggregate: DispatchAggregateRow,
  probeLimit: 1 | null,
) {
  const blockers = {
    processing: aggregate.processing,
    failed: aggregate.failed,
    dead: aggregate.dead,
    unknownOutboxState: aggregate.unknownOutboxState,
    activeUnknownType: aggregate.activeUnknownType,
    ownershipAmbiguous: aggregate.ownershipAmbiguous,
    activeOwnershipWrongAdapter: aggregate.activeOwnershipWrongAdapter,
    activeOwnershipInvalidRoute: aggregate.activeOwnershipInvalidRoute,
    activeOwnershipTicketRouteMismatch:
      aggregate.activeOwnershipTicketRouteMismatch,
    providerUnknownState: aggregate.providerUnknownState,
    sponsoredNonterminal: aggregate.sponsoredNonterminal,
    sponsoredAmbiguous: aggregate.sponsoredAmbiguous,
    sponsoredCompensationRequired: aggregate.sponsoredCompensationRequired,
    sponsoredFailed: aggregate.sponsoredFailed,
    sponsoredExpiredLease: aggregate.sponsoredExpiredLease,
    sponsoredUnknownState: aggregate.sponsoredUnknownState,
  };
  if (Object.values(blockers).some((count) => count > 0n)) {
    throw controlError(
      "RESUME_BLOCKED_RISK_STATE",
      "Resume blocked: unresolved provider, processing, failed, dead, and ambiguous counts must all be zero",
    );
  }
  if (probeLimit === null && aggregate.activeBacklog > 0n) {
    throw controlError(
      "RESUME_BLOCKED_ACTIVE_BACKLOG",
      "Resume blocked: active backlog must be zero unless --probe-limit 1 is explicitly selected",
    );
  }
  if (
    (probeLimit === null && aggregate.providerUnresolved > 0n) ||
    (probeLimit === 1 && aggregate.providerUnresolved > 1n)
  ) {
    throw controlError(
      "RESUME_BLOCKED_RISK_STATE",
      "Resume blocked: unresolved provider jobs exceed the controlled dispatch allowance",
    );
  }
  if (
    probeLimit === 1 &&
    (aggregate.activeBacklog !== 1n || aggregate.claimableBacklog !== 1n)
  ) {
    throw controlError(
      "PROBE_REQUIRES_EXACT_JOB",
      "Controlled probe requires exactly one active and claimable job",
    );
  }
}

function hasUnresolvedSideEffects(aggregate: DispatchAggregateRow) {
  return (
    aggregate.processing > 0n ||
    aggregate.failed > 0n ||
    aggregate.dead > 0n ||
    aggregate.activeBacklog > 0n ||
    aggregate.unknownOutboxState > 0n ||
    aggregate.activeUnknownType > 0n ||
    aggregate.ownershipAmbiguous > 0n ||
    aggregate.activeOwnershipWrongAdapter > 0n ||
    aggregate.activeOwnershipInvalidRoute > 0n ||
    aggregate.activeOwnershipTicketRouteMismatch > 0n ||
    aggregate.providerUnresolved > 0n ||
    aggregate.providerUnknownState > 0n ||
    aggregate.sponsoredNonterminal > 0n ||
    aggregate.sponsoredAmbiguous > 0n ||
    aggregate.sponsoredCompensationRequired > 0n ||
    aggregate.sponsoredFailed > 0n ||
    aggregate.sponsoredExpiredLease > 0n ||
    aggregate.sponsoredUnknownState > 0n
  );
}

function formatResult(
  action: DispatchAction,
  row: DispatchAggregateRow,
): DispatchControlSuccess {
  return {
    ok: true,
    action,
    control: {
      paused: row.paused,
      revision: row.revision.toString(),
      remainingClaims: row.remainingClaims,
    },
    counts: {
      processing: Number(row.processing),
      failed: Number(row.failed),
      dead: Number(row.dead),
      activeBacklog: Number(row.activeBacklog),
      claimableBacklog: Number(row.claimableBacklog),
      unknownOutboxState: Number(row.unknownOutboxState),
      activeUnknownType: Number(row.activeUnknownType),
      ownershipAmbiguous: Number(row.ownershipAmbiguous),
      activeOwnershipWrongAdapter: Number(row.activeOwnershipWrongAdapter),
      activeOwnershipInvalidRoute: Number(row.activeOwnershipInvalidRoute),
      activeOwnershipTicketRouteMismatch: Number(
        row.activeOwnershipTicketRouteMismatch,
      ),
      providerUnresolved: Number(row.providerUnresolved),
      providerUnknownState: Number(row.providerUnknownState),
      sponsoredNonterminal: Number(row.sponsoredNonterminal),
      sponsoredAmbiguous: Number(row.sponsoredAmbiguous),
      sponsoredCompensationRequired: Number(row.sponsoredCompensationRequired),
      sponsoredFailed: Number(row.sponsoredFailed),
      sponsoredExpiredLease: Number(row.sponsoredExpiredLease),
      sponsoredUnknownState: Number(row.sponsoredUnknownState),
    },
  };
}

export function redactedDispatchControlError(error: unknown) {
  if (error instanceof SideEffectDispatchControlError) {
    return {
      ok: false as const,
      error: { code: error.code, message: error.message },
    };
  }
  return {
    ok: false as const,
    error: {
      code: "DISPATCH_CONTROL_UNAVAILABLE" as const,
      message: "Side-effect dispatch control is unavailable",
    },
  };
}

function controlError(code: DispatchControlErrorCode, message: string) {
  return new SideEffectDispatchControlError(code, message);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const result = await runSideEffectDispatchControl(
      prisma as DispatchControlClient,
      process.argv.slice(2),
    );
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify(redactedDispatchControlError(error)));
    process.exitCode = 1;
  });
}
