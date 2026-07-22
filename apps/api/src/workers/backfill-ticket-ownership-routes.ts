import { Prisma, PrismaClient } from "@prisma/client";

const ACTIVE_OWNERSHIP_ROUTE_GUARD_SQL = Prisma.sql`
  type IN (
    'OWNERSHIP_ISSUE',
    'OWNERSHIP_ISSUE_RECEIPT_POLL',
    'OWNERSHIP_TRANSFER',
    'OWNERSHIP_RECEIPT_POLL',
    'OWNERSHIP_REDEEM',
    'OWNERSHIP_REDEEM_RECEIPT_POLL',
    'OWNERSHIP_SETTLEMENT_FINALIZE'
  )
  AND status IN ('PENDING', 'RETRYING', 'PROCESSING')
`;

type LegacyOwnershipAdapter = "mock" | "testnet" | "privy";

interface LegacyRouteConfig {
  adapter: LegacyOwnershipAdapter;
  contractRoute: {
    contractAddress: string;
    chainId: string;
    contractVersion: "fanpass-ticket-v1";
  } | null;
}

interface BackfillCounts {
  tokenizedTickets: number;
  activeJobs: number;
}

interface CountRow {
  count: bigint;
}

export async function backfillTicketOwnershipRoutes(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext('fanpass-schema-deploy-ticket-ownership-route-v1'))",
      );

      const counts = await missingRouteCounts(tx);
      if (counts.tokenizedTickets === 0 && counts.activeJobs === 0) {
        return { ...counts, ticketsUpdated: 0, jobsUpdated: 0 };
      }

      await assertNoUnroutableLegacyIssuanceJobs(tx);
      const legacy = readLegacyRouteConfig(env, counts);
      const ticketsUpdated = await backfillTickets(tx, legacy);
      const jobsUpdated = await backfillActiveJobs(tx, legacy);
      await assertBackfillComplete(tx);

      return { ...counts, ticketsUpdated, jobsUpdated };
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

async function assertNoUnroutableLegacyIssuanceJobs(
  tx: Prisma.TransactionClient,
) {
  const rows = await tx.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::bigint AS count
    FROM side_effect_outbox
    WHERE type IN ('OWNERSHIP_ISSUE', 'OWNERSHIP_ISSUE_RECEIPT_POLL')
      AND status IN ('PENDING', 'RETRYING', 'PROCESSING')
      AND NOT fanpass_validate_ownership_route_payload(payload_json)
  `;
  if (Number(rows[0]?.count ?? 0n) > 0) {
    throw new Error(
      "Legacy active ownership issuance jobs cannot be auto-routed because the old contract may not support logical-ticket reconciliation; drain or manually reconcile them before cutover",
    );
  }
}

async function missingRouteCounts(
  tx: Prisma.TransactionClient,
): Promise<BackfillCounts> {
  const [ticketRows, jobRows] = await Promise.all([
    tx.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM tickets
      WHERE token_id IS NOT NULL
        AND (
          ownership_contract_address IS NULL OR
          ownership_chain_id IS NULL OR
          ownership_contract_version IS NULL
        )
    `,
    tx.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM side_effect_outbox
      WHERE ${ACTIVE_OWNERSHIP_ROUTE_GUARD_SQL}
        AND NOT fanpass_validate_ownership_route_payload(payload_json)
    `),
  ]);
  return {
    tokenizedTickets: Number(ticketRows[0]?.count ?? 0n),
    activeJobs: Number(jobRows[0]?.count ?? 0n),
  };
}

function readLegacyRouteConfig(
  env: NodeJS.ProcessEnv,
  counts: BackfillCounts,
): LegacyRouteConfig {
  const adapter = env.FANPASS_LEGACY_OWNERSHIP_ADAPTER?.trim();
  if (adapter !== "mock" && adapter !== "testnet" && adapter !== "privy") {
    throw new Error(
      "FANPASS_LEGACY_OWNERSHIP_ADAPTER must explicitly identify the adapter that created legacy active ownership jobs",
    );
  }
  if (adapter === "mock") {
    if (counts.tokenizedTickets > 0) {
      throw new Error(
        "Tokenized tickets without a contract route cannot be backfilled as mock; supply the real legacy Web3 adapter and contract route",
      );
    }
    return { adapter, contractRoute: null };
  }

  const contractAddress =
    env.FANPASS_LEGACY_TICKET_CONTRACT_ADDRESS?.trim().toLowerCase();
  const chainId = env.FANPASS_LEGACY_TICKET_CHAIN_ID?.trim();
  if (!contractAddress || !/^0x[a-f0-9]{40}$/.test(contractAddress)) {
    throw new Error(
      "FANPASS_LEGACY_TICKET_CONTRACT_ADDRESS must be the reviewed legacy EVM contract address",
    );
  }
  if (!chainId || !/^[1-9][0-9]*$/.test(chainId)) {
    throw new Error(
      "FANPASS_LEGACY_TICKET_CHAIN_ID must be the reviewed positive-integer legacy chain id",
    );
  }
  return {
    adapter,
    contractRoute: {
      contractAddress,
      chainId,
      contractVersion: "fanpass-ticket-v1",
    },
  };
}

async function backfillTickets(
  tx: Prisma.TransactionClient,
  legacy: LegacyRouteConfig,
) {
  if (!legacy.contractRoute) {
    return 0;
  }
  const partial = await tx.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::bigint AS count
    FROM tickets
    WHERE (
      ownership_contract_address IS NOT NULL OR
      ownership_chain_id IS NOT NULL OR
      ownership_contract_version IS NOT NULL
    ) AND NOT (
      ownership_contract_address IS NOT NULL AND
      ownership_chain_id IS NOT NULL AND
      ownership_contract_version IS NOT NULL
    )
  `;
  if (Number(partial[0]?.count ?? 0n) > 0) {
    throw new Error(
      "Tickets contain a partial ownership route; stop and review those rows instead of overwriting provenance",
    );
  }

  const route = legacy.contractRoute;
  return tx.$executeRaw`
    UPDATE tickets AS ticket
    SET
      ownership_contract_address = ${route.contractAddress},
      ownership_chain_id = ${route.chainId},
      ownership_contract_version = ${route.contractVersion}
    WHERE ticket.ownership_contract_address IS NULL
      AND ticket.ownership_chain_id IS NULL
      AND ticket.ownership_contract_version IS NULL
      AND (
        ticket.token_id IS NOT NULL OR
        EXISTS (
          SELECT 1
          FROM side_effect_outbox AS job
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
            AND COALESCE(
              job.payload_json ->> 'localTicketId',
              job.payload_json ->> 'ticketId',
              CASE WHEN job.aggregate_type = 'ticket' THEN job.aggregate_id END
            ) = ticket.id
        )
      )
  `;
}

async function backfillActiveJobs(
  tx: Prisma.TransactionClient,
  legacy: LegacyRouteConfig,
) {
  const incompatibleAdapter = await tx.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM side_effect_outbox
    WHERE ${ACTIVE_OWNERSHIP_ROUTE_GUARD_SQL}
      AND NOT fanpass_validate_ownership_route_payload(payload_json)
      AND payload_json ? 'ownershipAdapter'
      AND payload_json ->> 'ownershipAdapter' <> ${legacy.adapter}
  `);
  if (Number(incompatibleAdapter[0]?.count ?? 0n) > 0) {
    throw new Error(
      "An active ownership job has an adapter snapshot that conflicts with FANPASS_LEGACY_OWNERSHIP_ADAPTER; stop for manual reconciliation",
    );
  }

  const malformed = await tx.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM side_effect_outbox
    WHERE ${ACTIVE_OWNERSHIP_ROUTE_GUARD_SQL}
      AND (
        (
          payload_json ? 'ownershipAdapter' AND
          payload_json ->> 'ownershipAdapter' NOT IN ('mock', 'testnet', 'privy')
        ) OR (
          payload_json ? 'contractRoute' AND
          payload_json -> 'contractRoute' IS NOT NULL AND
          jsonb_typeof(payload_json -> 'contractRoute') <> 'null' AND
          payload_json ->> 'ownershipAdapter' <> 'mock' AND
          NOT fanpass_validate_ownership_route_payload(payload_json)
        )
      )
  `);
  if (Number(malformed[0]?.count ?? 0n) > 0) {
    throw new Error(
      "Active ownership jobs contain malformed route provenance; stop for manual reconciliation instead of overwriting it",
    );
  }

  if (legacy.contractRoute) {
    const routeJson = JSON.stringify(legacy.contractRoute);
    return tx.$executeRaw(Prisma.sql`
      UPDATE side_effect_outbox
      SET payload_json = jsonb_set(jsonb_set(
        payload_json,
        '{ownershipAdapter}',
        to_jsonb(COALESCE(payload_json ->> 'ownershipAdapter', ${legacy.adapter})::text),
        true
      ),
        '{contractRoute}',
        CASE
          WHEN NOT (payload_json ? 'contractRoute') OR
               payload_json -> 'contractRoute' IS NULL OR
               jsonb_typeof(payload_json -> 'contractRoute') = 'null'
          THEN CAST(${routeJson} AS jsonb)
          ELSE payload_json -> 'contractRoute'
        END,
        true
      )
      WHERE ${ACTIVE_OWNERSHIP_ROUTE_GUARD_SQL}
        AND COALESCE(
          payload_json ->> 'ownershipAdapter',
          ${legacy.adapter}
        ) <> 'mock'
        AND (
          NOT (payload_json ? 'ownershipAdapter') OR
          NOT (payload_json ? 'contractRoute') OR
          payload_json -> 'contractRoute' IS NULL OR
          jsonb_typeof(payload_json -> 'contractRoute') = 'null'
        )
    `);
  }
  return tx.$executeRaw(Prisma.sql`
    UPDATE side_effect_outbox
    SET payload_json = jsonb_set(
      payload_json,
      '{ownershipAdapter}',
      to_jsonb(${legacy.adapter}::text),
      true
    )
    WHERE ${ACTIVE_OWNERSHIP_ROUTE_GUARD_SQL}
      AND NOT (payload_json ? 'ownershipAdapter')
  `);
}

async function assertBackfillComplete(tx: Prisma.TransactionClient) {
  const [tokenized, jobs] = await Promise.all([
    tx.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM tickets
      WHERE token_id IS NOT NULL
        AND (
          ownership_contract_address IS NULL OR
          ownership_chain_id IS NULL OR
          ownership_contract_version IS NULL
        )
    `,
    tx.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM side_effect_outbox
      WHERE ${ACTIVE_OWNERSHIP_ROUTE_GUARD_SQL}
        AND NOT fanpass_validate_ownership_route_payload(payload_json)
    `),
  ]);
  if (
    Number(tokenized[0]?.count ?? 0n) > 0 ||
    Number(jobs[0]?.count ?? 0n) > 0
  ) {
    throw new Error(
      "Ownership route backfill is incomplete; keep the ownership worker disabled and do not cut over contract configuration",
    );
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await backfillTicketOwnershipRoutes(prisma);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
