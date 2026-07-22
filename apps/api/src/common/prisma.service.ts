import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    if (process.env.FANPASS_ENABLE_PRISMA_CONNECT === "true") {
      await this.$connect();
      await this.assertProductionOwnershipRouteIntegrity();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async assertProductionOwnershipRouteIntegrity() {
    const environment = (process.env.FANPASS_ENV ?? process.env.NODE_ENV ?? "")
      .trim()
      .toLowerCase();
    if (
      !["staging", "production", "prod"].includes(environment) ||
      process.env.OWNERSHIP_ADAPTER === "mock"
    ) {
      return;
    }

    const [guard] = await this.$queryRaw<
      Array<{ triggerInstalled: boolean; validatorInstalled: boolean }>
    >`
      SELECT
        EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'side_effect_outbox_ownership_route_guard'
            AND tgrelid = 'side_effect_outbox'::regclass
            AND tgenabled <> 'D'
        ) AS "triggerInstalled",
        to_regprocedure(
          'fanpass_validate_ownership_route_payload(jsonb)'
        ) IS NOT NULL AS "validatorInstalled"
    `;
    if (!guard?.triggerInstalled || !guard.validatorInstalled) {
      throw new Error(
        "Ticket ownership route database guards are not installed; refuse to start a production-like Web3 API",
      );
    }

    const [integrity] = await this.$queryRaw<
      Array<{ ticketsMissingRoute: bigint; activeJobsMissingRoute: bigint }>
    >`
      SELECT
        (
          SELECT COUNT(*)::bigint
          FROM tickets
          WHERE token_id IS NOT NULL
            AND (
              ownership_contract_address IS NULL OR
              ownership_chain_id IS NULL OR
              ownership_contract_version IS NULL
            )
        ) AS "ticketsMissingRoute",
        (
          SELECT COUNT(*)::bigint
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
            AND NOT fanpass_validate_ownership_route_payload(payload_json)
        ) AS "activeJobsMissingRoute"
    `;
    if (
      !integrity ||
      integrity.ticketsMissingRoute > 0n ||
      integrity.activeJobsMissingRoute > 0n
    ) {
      throw new Error(
        "Ticket ownership route backfill is incomplete; keep the ownership worker disabled and do not cut over contracts",
      );
    }
  }
}
