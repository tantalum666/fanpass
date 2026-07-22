import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  OWNERSHIP_AMBIGUOUS_ERROR_MARKER,
  OwnershipOperationError,
} from "../src/modules/ownership/ownership.service";
import {
  OWNERSHIP_SUBMISSION_STARTED_MARKER,
  OWNERSHIP_SUBMISSION_STARTED_PAYLOAD_KEY,
  SideEffectDispatchFencedError,
} from "../src/modules/side-effects/side-effect-outbox.service";
import { SideEffectWorkerService } from "../src/modules/side-effects/side-effect-worker.service";
import { walletBindingFingerprint } from "../src/common/wallet-binding";

const OLD_CONTRACT_ROUTE = {
  contractAddress: "0x0000000000000000000000000000000000001000",
  chainId: "11155111",
  contractVersion: "fanpass-ticket-v1" as const,
};

describe("SideEffectWorkerService", () => {
  it("fences a paused or superseded claim before provider dispatch", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "PAYMENT_INTENT_CREATE",
        idempotencyKey: "payment-intent-create:pay_fenced",
        payloadJson: { paymentId: "pay_fenced" },
      }),
    ]);
    jest
      .spyOn(outbox, "assertClaimRevisionCurrent")
      .mockRejectedValue(new SideEffectDispatchFencedError());
    const payments = { processCreateIntentJob: jest.fn() };
    const worker = new SideEffectWorkerService(
      outbox as never,
      {} as never,
      payments as never,
      {} as never,
    );

    await expect(worker.workOnce()).resolves.toMatchObject({
      processed: 1,
      completed: 0,
      retried: 1,
    });
    expect(payments.processCreateIntentJob).not.toHaveBeenCalled();
    expect(outbox.retried).toHaveLength(1);
    expect(outbox.retried[0]?.error).toBeInstanceOf(
      SideEffectDispatchFencedError,
    );
  });

  it("rechecks the claim revision in the provider hook after dispatch preparation", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "PAYMENT_INTENT_CREATE",
        idempotencyKey: "payment-intent-create:pay_pause_race",
        payloadJson: { paymentId: "pay_pause_race" },
      }),
    ]);
    jest
      .spyOn(outbox, "assertClaimRevisionCurrent")
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new SideEffectDispatchFencedError());
    const providerSubmit = jest.fn();
    const payments = {
      processCreateIntentJob: jest.fn(
        async (
          _paymentId: string,
          hooks: { beforeProviderSubmission?: () => Promise<void> },
        ) => {
          await hooks.beforeProviderSubmission?.();
          providerSubmit();
          return {};
        },
      ),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      {} as never,
      payments as never,
      {} as never,
    );

    await expect(worker.workOnce()).resolves.toMatchObject({
      processed: 1,
      completed: 0,
      retried: 1,
    });
    expect(outbox.assertClaimRevisionCurrent).toHaveBeenCalledTimes(2);
    expect(providerSubmit).not.toHaveBeenCalled();
  });

  it("claims and completes an ownership issue side-effect", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE",
        idempotencyKey: "ownership-issue:tkt_demo_new",
        payloadJson: {
          localTicketId: "tkt_demo_new",
          tokenIdHint: "42",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: null,
          transferable: true,
          resaleCap: 1200,
          maxTransferCount: 2,
          metadataUri: null,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "mock"),
      issueTicket: jest.fn(async () => ({
        adapter: "mock",
        status: "CONFIRMED",
        tokenId: "42",
        ownershipRef: "mock:ticket:tkt_demo_new",
        transactionHash: "mock_issue_tx",
      })),
    };
    const orderbook = {
      finalizePrimaryOwnershipIssue: jest.fn().mockResolvedValue(null),
      failPrimaryOwnershipIssue: jest.fn(),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
    );
    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(ownership.issueTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        localTicketId: "tkt_demo_new",
        tokenIdHint: "42",
        eventId: "evt_weekend_demo",
        ticketTypeId: "tt_cat2_demo",
        ownerId: "usr_fan_demo",
        ownerWalletAddress: null,
        transferable: true,
        resaleCap: 1200,
        maxTransferCount: 2,
        metadataUri: null,
        idempotencyKey: "ownership-issue:tkt_demo_new",
      }),
    );
    expect(orderbook.finalizePrimaryOwnershipIssue).toHaveBeenCalledWith(
      "tkt_demo_new",
    );
    expect(orderbook.failPrimaryOwnershipIssue).not.toHaveBeenCalled();
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        tokenId: "42",
        ownershipAdapter: "mock",
        ownershipRef: "mock:ticket:tkt_demo_new",
        transactionHash: "mock_issue_tx",
      }),
    });
  });

  it("keeps pending issuance unusable and polls the same transaction", async () => {
    const payload = {
      localTicketId: "tkt_pending_issue",
      tokenIdHint: "42",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ownerId: "usr_fan_demo",
      ownerWalletAddress: "0x0000000000000000000000000000000000002001",
      transferable: true,
      resaleCap: 1200,
      maxTransferCount: 2,
      metadataUri: null,
      contractRoute: OLD_CONTRACT_ROUTE,
    };
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE",
        idempotencyKey: "ownership-issue:tkt_pending_issue",
        payloadJson: payload,
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "mock"),
      issueTicket: jest.fn().mockResolvedValue({
        adapter: "privy",
        status: "PENDING",
        tokenId: "42",
        ownershipRef: "0xcontract:42",
        transactionHash: "0xpending_issue",
        contractRoute: OLD_CONTRACT_ROUTE,
      }),
    };
    const updateTicket = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          ticket: { updateMany: updateTicket },
          auditLog: { create: jest.fn() },
        }),
      ),
    };
    const orderbook = {
      finalizePrimaryOwnershipIssue: jest.fn(),
      failPrimaryOwnershipIssue: jest.fn(),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
      prisma as never,
    );

    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(updateTicket).toHaveBeenCalledWith({
      where: {
        id: "tkt_pending_issue",
        status: "CREATED",
        ownershipContractAddress: OLD_CONTRACT_ROUTE.contractAddress,
        ownershipChainId: OLD_CONTRACT_ROUTE.chainId,
        ownershipContractVersion: OLD_CONTRACT_ROUTE.contractVersion,
      },
      data: {
        status: "CREATED",
        ownershipContractAddress: OLD_CONTRACT_ROUTE.contractAddress,
        ownershipChainId: OLD_CONTRACT_ROUTE.chainId,
        ownershipContractVersion: OLD_CONTRACT_ROUTE.contractVersion,
      },
    });
    expect(outbox.enqueued).toContainEqual(
      expect.objectContaining({
        type: "OWNERSHIP_ISSUE_RECEIPT_POLL",
        idempotencyKey: "ownership-issue-receipt:0xpending_issue",
        payload: expect.objectContaining({
          ...payload,
          ownershipStatus: "PENDING",
          transactionHash: "0xpending_issue",
        }),
      }),
    );
    expect(orderbook.finalizePrimaryOwnershipIssue).not.toHaveBeenCalled();
    expect(orderbook.failPrimaryOwnershipIssue).not.toHaveBeenCalled();
  });

  it("revalidates the current Privy custody binding before issuance broadcast", async () => {
    const walletAddress = "0x0000000000000000000000000000000000002001";
    const walletBinding = {
      privyId: "did:privy:fan-demo",
      privyWalletId: "wallet_fan_demo",
      walletAddress,
      walletBindingStatus: "VERIFIED" as const,
      walletBindingVerifiedAt: new Date("2026-07-20T00:00:00.000Z"),
      walletBindingVersion: 3,
      walletBindingFingerprint: walletBindingFingerprint({
        privyId: "did:privy:fan-demo",
        walletId: "wallet_fan_demo",
        walletAddress,
      }),
    };
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE",
        idempotencyKey: "ownership-issue:tkt_verified",
        payloadJson: {
          ownershipAdapter: "privy",
          localTicketId: "tkt_verified",
          tokenIdHint: "42",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: walletAddress,
          ownerWalletBindingVersion: walletBinding.walletBindingVersion,
          ownerWalletBindingFingerprint: walletBinding.walletBindingFingerprint,
          transferable: true,
          resaleCap: 1200,
          maxTransferCount: 2,
          metadataUri: null,
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "privy"),
      verifyPrivyWalletBinding: jest.fn().mockResolvedValue(undefined),
      issueTicket: jest.fn(
        async (
          _input: unknown,
          hooks: { beforeProviderSubmission?: () => Promise<void> },
        ) => {
          await hooks.beforeProviderSubmission?.();
          return {
            adapter: "privy",
            status: "CONFIRMED",
            tokenId: "42",
            ownershipRef: "0xcontract:42",
            transactionHash: "0xconfirmed_issue",
            contractRoute: OLD_CONTRACT_ROUTE,
          };
        },
      ),
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(walletBinding) },
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          ticket: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          auditLog: { create: jest.fn() },
        }),
      ),
    };
    const orderbook = {
      finalizePrimaryOwnershipIssue: jest.fn().mockResolvedValue(null),
      failPrimaryOwnershipIssue: jest.fn(),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
      prisma as never,
    );

    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(ownership.verifyPrivyWalletBinding).toHaveBeenCalledWith({
      privyUserId: walletBinding.privyId,
      walletId: walletBinding.privyWalletId,
      walletAddress,
    });
    expect(ownership.issueTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "ownership-issue:tkt_verified",
      }),
      expect.objectContaining({
        beforeProviderSubmission: expect.any(Function),
      }),
    );
    expect(
      ownership.verifyPrivyWalletBinding.mock.invocationCallOrder[0],
    ).toBeLessThan(ownership.issueTicket.mock.invocationCallOrder[0]);
    expect(outbox.submissionStarted).toEqual(["sfx_demo"]);
    expect(orderbook.finalizePrimaryOwnershipIssue).toHaveBeenCalledWith(
      "tkt_verified",
    );
  });

  it("fails closed for legacy Privy issuance payloads without a binding snapshot", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE",
        payloadJson: {
          ownershipAdapter: "privy",
          localTicketId: "tkt_legacy",
          tokenIdHint: "42",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: "0x0000000000000000000000000000000000002001",
          transferable: true,
          resaleCap: 1200,
          maxTransferCount: 2,
          metadataUri: null,
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "privy"),
      verifyPrivyWalletBinding: jest.fn(),
      issueTicket: jest.fn(),
    };
    const orderbook = {
      failPrimaryOwnershipIssue: jest.fn().mockResolvedValue({ failed: true }),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
      { user: { findUnique: jest.fn() } } as never,
    );

    const result = await worker.workOnce();

    expect(result).toMatchObject({ completed: 0, retried: 0, dead: 1 });
    expect(ownership.verifyPrivyWalletBinding).not.toHaveBeenCalled();
    expect(ownership.issueTicket).not.toHaveBeenCalled();
    expect(orderbook.failPrimaryOwnershipIssue).toHaveBeenCalledWith(
      "tkt_legacy",
      expect.any(Error),
    );
  });

  it("never submits a legacy Web3 ownership job without a contract route snapshot", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE",
        payloadJson: {
          ownershipAdapter: "privy",
          localTicketId: "tkt_missing_route",
          tokenIdHint: "42",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: "0x0000000000000000000000000000000000002001",
          ownerWalletBindingVersion: 3,
          ownerWalletBindingFingerprint: "a".repeat(64),
          transferable: true,
          resaleCap: 1200,
          maxTransferCount: 2,
          metadataUri: null,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "privy"),
      verifyPrivyWalletBinding: jest.fn(),
      issueTicket: jest.fn(),
    };
    const orderbook = {
      failPrimaryOwnershipIssue: jest.fn().mockResolvedValue({ failed: true }),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
    );

    const result = await worker.workOnce();

    expect(result).toMatchObject({ completed: 0, retried: 0, dead: 1 });
    expect(ownership.verifyPrivyWalletBinding).not.toHaveBeenCalled();
    expect(ownership.issueTicket).not.toHaveBeenCalled();
    expect(orderbook.failPrimaryOwnershipIssue).toHaveBeenCalledWith(
      "tkt_missing_route",
      expect.objectContaining({
        message: expect.stringContaining("immutable contract route"),
      }),
    );
  });

  it("compensates a terminal Privy preflight failure before the submission hook runs", async () => {
    const walletAddress = "0x0000000000000000000000000000000000002001";
    const walletBinding = {
      privyId: "did:privy:fan-demo",
      privyWalletId: "wallet_fan_demo",
      walletAddress,
      walletBindingStatus: "VERIFIED" as const,
      walletBindingVerifiedAt: new Date("2026-07-20T00:00:00.000Z"),
      walletBindingVersion: 3,
      walletBindingFingerprint: walletBindingFingerprint({
        privyId: "did:privy:fan-demo",
        walletId: "wallet_fan_demo",
        walletAddress,
      }),
    };
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE",
        attempts: 4,
        payloadJson: {
          ownershipAdapter: "privy",
          localTicketId: "tkt_privy_preflight_failed",
          tokenIdHint: "42",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: walletAddress,
          ownerWalletBindingVersion: walletBinding.walletBindingVersion,
          ownerWalletBindingFingerprint: walletBinding.walletBindingFingerprint,
          transferable: true,
          resaleCap: 1200,
          maxTransferCount: 2,
          metadataUri: null,
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const preflightError = new Error("reconciliation RPC unavailable");
    const ownership = {
      adapterName: jest.fn(() => "privy"),
      verifyPrivyWalletBinding: jest.fn().mockResolvedValue(undefined),
      issueTicket: jest
        .fn()
        .mockRejectedValue(
          OwnershipOperationError.definitelyNotSubmitted(
            preflightError,
            "Ownership issuance was not submitted",
          ),
        ),
    };
    const orderbook = {
      failPrimaryOwnershipIssue: jest.fn().mockResolvedValue({ failed: true }),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
      {
        user: { findUnique: jest.fn().mockResolvedValue(walletBinding) },
      } as never,
    );

    const result = await worker.workOnce();

    expect(result).toMatchObject({ completed: 0, retried: 0, dead: 1 });
    expect(outbox.submissionStarted).toHaveLength(0);
    expect(orderbook.failPrimaryOwnershipIssue).toHaveBeenCalledWith(
      "tkt_privy_preflight_failed",
      preflightError,
    );
  });

  it("retries a temporary Privy custody verification outage without broadcasting", async () => {
    const walletAddress = "0x0000000000000000000000000000000000002001";
    const walletBinding = {
      privyId: "did:privy:fan-demo",
      privyWalletId: "wallet_fan_demo",
      walletAddress,
      walletBindingStatus: "VERIFIED" as const,
      walletBindingVerifiedAt: new Date("2026-07-20T00:00:00.000Z"),
      walletBindingVersion: 3,
      walletBindingFingerprint: walletBindingFingerprint({
        privyId: "did:privy:fan-demo",
        walletId: "wallet_fan_demo",
        walletAddress,
      }),
    };
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE",
        payloadJson: {
          ownershipAdapter: "privy",
          localTicketId: "tkt_privy_outage",
          tokenIdHint: "42",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: walletAddress,
          ownerWalletBindingVersion: walletBinding.walletBindingVersion,
          ownerWalletBindingFingerprint: walletBinding.walletBindingFingerprint,
          transferable: true,
          resaleCap: 1200,
          maxTransferCount: 2,
          metadataUri: null,
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "privy"),
      verifyPrivyWalletBinding: jest
        .fn()
        .mockRejectedValue(
          new ServiceUnavailableException("Privy verification unavailable"),
        ),
      issueTicket: jest.fn(),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
      {
        user: { findUnique: jest.fn().mockResolvedValue(walletBinding) },
      } as never,
    );

    const result = await worker.workOnce();

    expect(result).toMatchObject({ completed: 0, retried: 1, dead: 0 });
    expect(ownership.issueTicket).not.toHaveBeenCalled();
  });

  it("dead-letters a Privy custody mismatch without broadcasting", async () => {
    const walletAddress = "0x0000000000000000000000000000000000002001";
    const walletBinding = {
      privyId: "did:privy:fan-demo",
      privyWalletId: "wallet_fan_demo",
      walletAddress,
      walletBindingStatus: "VERIFIED" as const,
      walletBindingVerifiedAt: new Date("2026-07-20T00:00:00.000Z"),
      walletBindingVersion: 3,
      walletBindingFingerprint: walletBindingFingerprint({
        privyId: "did:privy:fan-demo",
        walletId: "wallet_fan_demo",
        walletAddress,
      }),
    };
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE",
        payloadJson: {
          ownershipAdapter: "privy",
          localTicketId: "tkt_privy_mismatch",
          tokenIdHint: "42",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: walletAddress,
          ownerWalletBindingVersion: walletBinding.walletBindingVersion,
          ownerWalletBindingFingerprint: walletBinding.walletBindingFingerprint,
          transferable: true,
          resaleCap: 1200,
          maxTransferCount: 2,
          metadataUri: null,
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "privy"),
      verifyPrivyWalletBinding: jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException("Wallet is no longer linked"),
        ),
      issueTicket: jest.fn(),
    };
    const orderbook = {
      tryMatch: jest.fn(),
      failPrimaryOwnershipIssue: jest.fn(),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
      {
        user: { findUnique: jest.fn().mockResolvedValue(walletBinding) },
      } as never,
    );

    const result = await worker.workOnce();

    expect(result).toMatchObject({ completed: 0, retried: 0, dead: 1 });
    expect(ownership.issueTicket).not.toHaveBeenCalled();
    expect(orderbook.failPrimaryOwnershipIssue).toHaveBeenCalledWith(
      "tkt_privy_mismatch",
      expect.objectContaining({ message: "Wallet is no longer linked" }),
    );
  });

  it("activates a pending ticket only after its issuance receipt confirms", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE_RECEIPT_POLL",
        idempotencyKey: "ownership-issue-receipt:0xpending_issue",
        payloadJson: {
          localTicketId: "tkt_pending_issue",
          tokenIdHint: "42",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: "0x0000000000000000000000000000000000002001",
          transferable: true,
          resaleCap: 1200,
          maxTransferCount: 2,
          metadataUri: null,
          ownershipAdapter: "privy",
          ownershipStatus: "PENDING",
          tokenId: "42",
          ownershipRef: "0xcontract:42",
          transactionHash: "0xpending_issue",
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      issueTicket: jest.fn(),
      resolveReceipt: jest.fn().mockResolvedValue({
        adapter: "privy",
        status: "CONFIRMED",
        tokenId: "57",
        ownershipRef: "0xcontract:57",
        transactionHash: "0xpending_issue",
        contractRoute: OLD_CONTRACT_ROUTE,
      }),
    };
    const updateTicket = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          ticket: { updateMany: updateTicket },
          auditLog: { create: jest.fn() },
        }),
      ),
    };
    const orderbook = {
      finalizePrimaryOwnershipIssue: jest.fn().mockResolvedValue(null),
      failPrimaryOwnershipIssue: jest.fn(),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
      prisma as never,
    );

    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(ownership.issueTicket).not.toHaveBeenCalled();
    expect(ownership.resolveReceipt).toHaveBeenCalledWith({
      adapter: "privy",
      tokenId: "42",
      ownershipRef: "0xcontract:42",
      transactionHash: "0xpending_issue",
      operation: {
        type: "ISSUE",
        localTicketId: "tkt_pending_issue",
      },
      contractRoute: OLD_CONTRACT_ROUTE,
    });
    expect(updateTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "tkt_pending_issue",
          status: "CREATED",
        }),
        data: expect.objectContaining({
          status: "ACTIVE",
          tokenId: "57",
          ownershipContractAddress: OLD_CONTRACT_ROUTE.contractAddress,
        }),
      }),
    );
    expect(orderbook.finalizePrimaryOwnershipIssue).toHaveBeenCalledWith(
      "tkt_pending_issue",
    );
    expect(updateTicket.mock.invocationCallOrder[0]).toBeLessThan(
      orderbook.finalizePrimaryOwnershipIssue.mock.invocationCallOrder[0],
    );
  });

  it("rejects and compensates a primary settlement when issuance reverts", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE",
        payloadJson: {
          localTicketId: "tkt_failed_issue",
          tokenIdHint: "42",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: null,
          transferable: true,
          resaleCap: 1200,
          maxTransferCount: 2,
          metadataUri: null,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "mock"),
      issueTicket: jest.fn().mockResolvedValue({
        adapter: "privy",
        status: "FAILED",
        tokenId: "42",
        ownershipRef: "0xcontract:42",
        transactionHash: "0xfailed_issue",
      }),
    };
    const updateTicket = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          ticket: { updateMany: updateTicket },
          auditLog: { create: jest.fn() },
        }),
      ),
    };
    const orderbook = {
      finalizePrimaryOwnershipIssue: jest.fn(),
      failPrimaryOwnershipIssue: jest.fn().mockResolvedValue({ failed: true }),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
      prisma as never,
    );

    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(updateTicket).toHaveBeenCalledWith({
      where: { id: "tkt_failed_issue", status: "CREATED" },
      data: { status: "CANCELLED" },
    });
    expect(orderbook.finalizePrimaryOwnershipIssue).not.toHaveBeenCalled();
    expect(orderbook.failPrimaryOwnershipIssue).toHaveBeenCalledWith(
      "tkt_failed_issue",
      expect.objectContaining({
        message: "Ownership issuance transaction reverted",
      }),
    );
  });

  it("reschedules a pending issuance receipt without consuming failure attempts", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_ISSUE_RECEIPT_POLL",
        attempts: 4,
        payloadJson: {
          localTicketId: "tkt_pending_issue",
          tokenIdHint: "42",
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          ownerWalletAddress: "0x0000000000000000000000000000000000002001",
          transferable: true,
          resaleCap: 1200,
          maxTransferCount: 2,
          metadataUri: null,
          ownershipAdapter: "privy",
          ownershipStatus: "PENDING",
          tokenId: "42",
          ownershipRef: "0xcontract:42",
          transactionHash: "0xpending_issue",
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      resolveReceipt: jest.fn().mockResolvedValue({
        adapter: "privy",
        status: "PENDING",
        tokenId: "42",
        ownershipRef: "0xcontract:42",
        transactionHash: "0xpending_issue",
        contractRoute: OLD_CONTRACT_ROUTE,
      }),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result).toMatchObject({ completed: 0, retried: 1, dead: 0 });
    expect(outbox.retried).toHaveLength(0);
    expect(outbox.rescheduled).toEqual([
      { id: "sfx_demo", claimedAttempts: 5 },
    ]);
  });

  it("claims and completes an ownership transfer side-effect", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "mock"),
      transferTicket: jest.fn(async () => ({
        adapter: "mock",
        status: "CONFIRMED",
        tokenId: "1",
        ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
        transactionHash: "mock_tx",
      })),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );
    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 1,
      completed: 1,
      retried: 0,
      dead: 0,
    });
    expect(ownership.transferTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: "tkt_demo_001",
        tokenId: "1",
        fromOwnerId: "usr_fan_demo",
        fromWalletAddress: null,
        toOwnerId: "usr_buyer_demo",
        toWalletAddress: null,
        idempotencyKey: "ownership-transfer:buy:sell",
      }),
    );
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        ownershipAdapter: "mock",
        transactionHash: "mock_tx",
      }),
    });
  });

  it("compensates a resale settlement when wallet binding fails before submission", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        payloadJson: {
          ownershipAdapter: "privy",
          ticketId: "tkt_binding_failed",
          tokenId: "42",
          fromOwnerId: "usr_seller",
          fromWalletAddress: "0x0000000000000000000000000000000000002001",
          toOwnerId: "usr_buyer",
          toWalletAddress: "0x0000000000000000000000000000000000002002",
          buyOrderId: "ord_buy_binding_failed",
          sellOrderId: "ord_sell_binding_failed",
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "privy"),
      verifyPrivyWalletBinding: jest.fn(),
      transferTicket: jest.fn(),
    };
    const orderbook = {
      failOwnershipTransfer: jest.fn().mockResolvedValue({ failed: true }),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
      { user: { findUnique: jest.fn() } } as never,
    );

    const result = await worker.workOnce();

    expect(result).toMatchObject({ completed: 0, retried: 0, dead: 1 });
    expect(ownership.transferTicket).not.toHaveBeenCalled();
    expect(orderbook.failOwnershipTransfer).toHaveBeenCalledWith({
      buyOrderId: "ord_buy_binding_failed",
      sellOrderId: "ord_sell_binding_failed",
      ticketId: "tkt_binding_failed",
      reason: expect.stringContaining("not verified for custody"),
    });
  });

  it("does not compensate a resale settlement when the provider outcome is ambiguous", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        attempts: 4,
        payloadJson: {
          ticketId: "tkt_ambiguous",
          tokenId: "42",
          fromOwnerId: "usr_seller",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer",
          toWalletAddress: null,
          buyOrderId: "ord_buy_ambiguous",
          sellOrderId: "ord_sell_ambiguous",
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "mock"),
      transferTicket: jest
        .fn()
        .mockRejectedValue(
          OwnershipOperationError.ambiguous(
            new Error("Privy request timed out"),
            "Privy ownership submission is ambiguous",
          ),
        ),
    };
    const orderbook = {
      failOwnershipTransfer: jest.fn(),
      failPrimaryOwnershipIssue: jest.fn(),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
    );

    const result = await worker.workOnce();

    expect(result).toMatchObject({ completed: 0, retried: 0, dead: 1 });
    expect(orderbook.failOwnershipTransfer).not.toHaveBeenCalled();
    expect(orderbook.failPrimaryOwnershipIssue).not.toHaveBeenCalled();
    expect(outbox.retried[0]?.error).toMatchObject({
      submissionDisposition: "AMBIGUOUS",
      message: expect.stringContaining("manual reconciliation is required"),
    });
  });

  it("does not compensate after a durable submission marker survives an overwritten error", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        lastError: "Recovered stale PROCESSING lock after 300 seconds",
        payloadJson: {
          [OWNERSHIP_SUBMISSION_STARTED_PAYLOAD_KEY]: true,
          ownershipAdapter: "privy",
          ticketId: "tkt_prior_ambiguous",
          tokenId: "42",
          fromOwnerId: "usr_seller",
          fromWalletAddress: "0x0000000000000000000000000000000000002001",
          toOwnerId: "usr_buyer",
          toWalletAddress: "0x0000000000000000000000000000000000002002",
          buyOrderId: "ord_buy_prior_ambiguous",
          sellOrderId: "ord_sell_prior_ambiguous",
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "privy"),
      verifyPrivyWalletBinding: jest.fn(),
      transferTicket: jest.fn(),
    };
    const orderbook = {
      failOwnershipTransfer: jest.fn(),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
      { user: { findUnique: jest.fn() } } as never,
    );

    const result = await worker.workOnce();

    expect(result).toMatchObject({ completed: 0, retried: 0, dead: 1 });
    expect(ownership.transferTicket).not.toHaveBeenCalled();
    expect(orderbook.failOwnershipTransfer).not.toHaveBeenCalled();
  });

  it("enqueues ownership settlement finalization after a provider transfer succeeds", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
          buyOrderId: "ord_buy_demo",
          sellOrderId: "ord_sell_demo",
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "mock"),
      transferTicket: jest.fn(async () => ({
        adapter: "mock",
        status: "CONFIRMED",
        tokenId: "1",
        ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
        transactionHash: "mock_tx",
      })),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn(), finalizeOwnershipTransfer: jest.fn() } as never,
    );
    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(outbox.enqueued[0]).toMatchObject({
      type: "OWNERSHIP_SETTLEMENT_FINALIZE",
      idempotencyKey: "ownership-finalize:ord_buy_demo:ord_sell_demo",
      aggregateType: "trade",
      aggregateId: "ord_buy_demo:ord_sell_demo",
      payload: expect.objectContaining({
        ticketId: "tkt_demo_001",
        buyOrderId: "ord_buy_demo",
        sellOrderId: "ord_sell_demo",
        ownershipAdapter: "mock",
        ownershipStatus: "CONFIRMED",
        ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
        transactionHash: "mock_tx",
      }),
    });
  });

  it("polls a pending ownership transaction without resubmitting the transfer", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
          buyOrderId: "ord_buy_demo",
          sellOrderId: "ord_sell_demo",
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "mock"),
      transferTicket: jest.fn(async () => ({
        adapter: "privy",
        status: "PENDING",
        tokenId: "1",
        ownershipRef: "0xcontract:1",
        transactionHash: "0xpending",
      })),
    };
    const orderbook = {
      finalizeOwnershipTransfer: jest.fn(),
      failOwnershipTransfer: jest.fn(),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
    );
    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(outbox.enqueued).toHaveLength(1);
    expect(outbox.enqueued[0]).toMatchObject({
      type: "OWNERSHIP_RECEIPT_POLL",
      idempotencyKey: "ownership-receipt:0xpending",
      payload: expect.objectContaining({
        ownershipStatus: "PENDING",
        transactionHash: "0xpending",
      }),
    });
    expect(orderbook.finalizeOwnershipTransfer).not.toHaveBeenCalled();
    expect(orderbook.failOwnershipTransfer).not.toHaveBeenCalled();
  });

  it("finalizes only after the existing ownership transaction is confirmed", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_RECEIPT_POLL",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
          buyOrderId: "ord_buy_demo",
          sellOrderId: "ord_sell_demo",
          ownershipAdapter: "privy",
          ownershipStatus: "PENDING",
          ownershipRef: "0xcontract:1",
          transactionHash: "0xpending",
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      transferTicket: jest.fn(),
      resolveReceipt: jest.fn(async () => ({
        adapter: "privy",
        status: "CONFIRMED",
        tokenId: "1",
        ownershipRef: "0xcontract:1",
        transactionHash: "0xpending",
        contractRoute: OLD_CONTRACT_ROUTE,
      })),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      {
        finalizeOwnershipTransfer: jest.fn(),
        failOwnershipTransfer: jest.fn(),
      } as never,
    );
    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(ownership.transferTicket).not.toHaveBeenCalled();
    expect(ownership.resolveReceipt).toHaveBeenCalledWith({
      adapter: "privy",
      tokenId: "1",
      ownershipRef: "0xcontract:1",
      transactionHash: "0xpending",
      operation: {
        type: "TRANSFER",
        fromWalletAddress: null,
        toWalletAddress: null,
      },
      contractRoute: OLD_CONTRACT_ROUTE,
    });
    expect(outbox.enqueued[0]).toMatchObject({
      type: "OWNERSHIP_SETTLEMENT_FINALIZE",
      payload: expect.objectContaining({ ownershipStatus: "CONFIRMED" }),
    });
  });

  it("retries receipt polling without submitting another ownership transaction", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_RECEIPT_POLL",
        attempts: 4,
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
          buyOrderId: "ord_buy_demo",
          sellOrderId: "ord_sell_demo",
          ownershipAdapter: "privy",
          ownershipStatus: "PENDING",
          ownershipRef: "0xcontract:1",
          transactionHash: "0xpending",
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      transferTicket: jest.fn(),
      resolveReceipt: jest.fn(async () => ({
        adapter: "privy",
        status: "PENDING",
        tokenId: "1",
        ownershipRef: "0xcontract:1",
        transactionHash: "0xpending",
        contractRoute: OLD_CONTRACT_ROUTE,
      })),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { failOwnershipTransfer: jest.fn() } as never,
    );
    const result = await worker.workOnce();

    expect(result.retried).toBe(1);
    expect(result.completed).toBe(0);
    expect(ownership.transferTicket).not.toHaveBeenCalled();
    expect(outbox.enqueued).toHaveLength(0);
    expect(outbox.retried).toHaveLength(0);
    expect(outbox.rescheduled).toEqual([
      { id: "sfx_demo", claimedAttempts: 5 },
    ]);
  });

  it("fails the matched order and never finalizes a reverted ownership transaction", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
          buyOrderId: "ord_buy_demo",
          sellOrderId: "ord_sell_demo",
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "mock"),
      transferTicket: jest.fn(async () => ({
        adapter: "privy",
        status: "FAILED",
        tokenId: "1",
        ownershipRef: "0xcontract:1",
        transactionHash: "0xfailed",
      })),
    };
    const orderbook = {
      finalizeOwnershipTransfer: jest.fn(),
      failOwnershipTransfer: jest.fn(async () => ({ failed: true })),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
    );
    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(orderbook.failOwnershipTransfer).toHaveBeenCalledWith({
      buyOrderId: "ord_buy_demo",
      sellOrderId: "ord_sell_demo",
      ticketId: "tkt_demo_001",
      reason: "Ownership transaction reverted",
    });
    expect(orderbook.finalizeOwnershipTransfer).not.toHaveBeenCalled();
    expect(outbox.enqueued).toHaveLength(0);
  });

  it("finalizes ownership settlement without re-running the provider transfer", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_SETTLEMENT_FINALIZE",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
          buyOrderId: "ord_buy_demo",
          sellOrderId: "ord_sell_demo",
          ownershipAdapter: "mock",
          ownershipStatus: "CONFIRMED",
          ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
          transactionHash: "mock_tx",
        },
      }),
    ]);
    const ownership = {
      transferTicket: jest.fn(),
    };
    const orderbook = {
      finalizeOwnershipTransfer: jest.fn(async () => ({
        id: "trd_demo",
      })),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
    );
    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(ownership.transferTicket).not.toHaveBeenCalled();
    expect(orderbook.finalizeOwnershipTransfer).toHaveBeenCalledWith({
      buyOrderId: "ord_buy_demo",
      sellOrderId: "ord_sell_demo",
      ticketId: "tkt_demo_001",
      ownership: {
        adapter: "mock",
        status: "CONFIRMED",
        tokenId: "1",
        ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
        transactionHash: "mock_tx",
        contractRoute: null,
      },
    });
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: {
        buyOrderId: "ord_buy_demo",
        sellOrderId: "ord_sell_demo",
        ticketId: "tkt_demo_001",
        tradeId: "trd_demo",
        finalized: true,
      },
    });
  });

  it("claims and completes an ownership redeem side-effect", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_REDEEM",
        idempotencyKey: "ownership-redeem:tkt_demo_001:1",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "mock"),
      redeemTicket: jest.fn(async () => ({
        adapter: "mock",
        status: "CONFIRMED",
        tokenId: "1",
        ownershipRef: "mock:redeem:tkt_demo_001",
        transactionHash: "mock_redeem_tx",
      })),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );
    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(ownership.redeemTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: "tkt_demo_001",
        tokenId: "1",
        idempotencyKey: "ownership-redeem:tkt_demo_001:1",
      }),
    );
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        tokenId: "1",
        ownershipAdapter: "mock",
        ownershipRef: "mock:redeem:tkt_demo_001",
        transactionHash: "mock_redeem_tx",
      }),
    });
  });

  it("polls a pending redemption without submitting it again", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_REDEEM",
        idempotencyKey: "ownership-redeem:tkt_demo_001:1",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      adapterName: jest.fn(() => "mock"),
      redeemTicket: jest.fn().mockResolvedValue({
        adapter: "privy",
        status: "PENDING",
        tokenId: "1",
        ownershipRef: "0xcontract:1",
        transactionHash: "0xpending_redeem",
        contractRoute: OLD_CONTRACT_ROUTE,
      }),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(outbox.enqueued).toContainEqual(
      expect.objectContaining({
        type: "OWNERSHIP_REDEEM_RECEIPT_POLL",
        idempotencyKey: "ownership-redeem-receipt:0xpending_redeem",
        payload: expect.objectContaining({
          ticketId: "tkt_demo_001",
          ownershipStatus: "PENDING",
          transactionHash: "0xpending_redeem",
          contractRoute: OLD_CONTRACT_ROUTE,
        }),
      }),
    );
  });

  it("completes redemption only after the existing receipt confirms", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_REDEEM_RECEIPT_POLL",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          ownershipAdapter: "privy",
          ownershipStatus: "PENDING",
          ownershipRef: "0xcontract:1",
          transactionHash: "0xpending_redeem",
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      redeemTicket: jest.fn(),
      resolveReceipt: jest.fn().mockResolvedValue({
        adapter: "privy",
        status: "CONFIRMED",
        tokenId: "1",
        ownershipRef: "0xcontract:1",
        transactionHash: "0xpending_redeem",
        contractRoute: OLD_CONTRACT_ROUTE,
      }),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(ownership.redeemTicket).not.toHaveBeenCalled();
    expect(ownership.resolveReceipt).toHaveBeenCalledWith({
      adapter: "privy",
      tokenId: "1",
      ownershipRef: "0xcontract:1",
      transactionHash: "0xpending_redeem",
      operation: { type: "REDEEM" },
      contractRoute: OLD_CONTRACT_ROUTE,
    });
  });

  it("keeps terminal redemption proof failures observable", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_REDEEM_RECEIPT_POLL",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          ownershipAdapter: "privy",
          ownershipStatus: "PENDING",
          ownershipRef: "0xcontract:1",
          transactionHash: "0xfailed_redeem",
          contractRoute: OLD_CONTRACT_ROUTE,
        },
      }),
    ]);
    const ownership = {
      resolveReceipt: jest.fn().mockResolvedValue({
        adapter: "privy",
        status: "FAILED",
        tokenId: "1",
        ownershipRef: "0xcontract:1",
        transactionHash: "0xfailed_redeem",
        contractRoute: OLD_CONTRACT_ROUTE,
      }),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result).toMatchObject({ completed: 0, retried: 0, dead: 1 });
    expect(outbox.retried[0]).toMatchObject({
      id: "sfx_demo",
      attempts: 1,
    });
  });

  it("marks unknown side-effect types for retry", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "UNKNOWN",
        payloadJson: {},
      }),
    ]);
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 1,
      completed: 0,
      retried: 1,
      dead: 0,
    });
    expect(outbox.retried[0]).toMatchObject({
      id: "sfx_demo",
      attempts: 1,
    });
  });

  it("recovers stale processing locks before reading due jobs", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
        },
      }),
    ]);
    outbox.recoveredCount = 1;
    const worker = new SideEffectWorkerService(
      outbox as never,
      {
        adapterName: jest.fn(() => "mock"),
        transferTicket: jest.fn(async () => ({
          adapter: "mock",
          status: "CONFIRMED",
          tokenId: "1",
          ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
          transactionHash: "mock_tx",
        })),
      } as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result.recovered).toBe(1);
    expect(outbox.recoveredBeforePending).toBe(true);
    expect(result.completed).toBe(1);
  });

  it("claims and completes a payment intent side-effect", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "PAYMENT_INTENT_CREATE",
        payloadJson: {
          paymentId: "pay_demo",
        },
      }),
    ]);
    const payments = {
      processCreateIntentJob: jest.fn(async () => ({
        paymentId: "pay_demo",
        orderId: "ord_demo",
        stripePaymentIntentId: "pi_mock_pay_demo",
        status: "requires_payment_method",
        captureStatus: "NOT_CAPTURED",
      })),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      payments as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 1,
      completed: 1,
      retried: 0,
      dead: 0,
    });
    expect(payments.processCreateIntentJob).toHaveBeenCalledWith("pay_demo", {
      beforeProviderSubmission: expect.any(Function),
    });
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        stripePaymentIntentId: "pi_mock_pay_demo",
      }),
    });
  });

  it("claims and completes a payment capture side-effect", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "PAYMENT_CAPTURE",
        idempotencyKey: "payment-capture:pay_demo:trd_demo",
        payloadJson: {
          paymentId: "pay_demo",
          tradeId: "trd_demo",
          ticketId: "tkt_demo_001",
        },
      }),
    ]);
    const payments = {
      processCaptureJob: jest.fn(async () => ({
        paymentId: "pay_demo",
        orderId: "ord_demo",
        stripePaymentIntentId: "pi_mock_pay_demo",
        status: "succeeded",
        captureStatus: "CAPTURED",
      })),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      payments as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 1,
      completed: 1,
      retried: 0,
      dead: 0,
    });
    expect(payments.processCaptureJob).toHaveBeenCalledWith(
      "pay_demo",
      "trd_demo",
      "tkt_demo_001",
      "payment-capture:pay_demo:trd_demo",
      { beforeProviderSubmission: expect.any(Function) },
    );
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        captureStatus: "CAPTURED",
      }),
    });
  });

  it("claims payment compensation side-effects", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        id: "sfx_cancel",
        type: "PAYMENT_CANCEL_AUTHORIZATION",
        idempotencyKey: "payment-cancel:pay_auth:ownership_transfer_failed",
        payloadJson: {
          paymentId: "pay_auth",
          reason: "ownership_transfer_failed",
        },
      }),
      fakeJob({
        id: "sfx_refund",
        type: "PAYMENT_REFUND",
        idempotencyKey: "payment-refund:pay_capture:event_cancelled",
        payloadJson: {
          paymentId: "pay_capture",
          reason: "event_cancelled",
        },
      }),
      fakeJob({
        id: "sfx_reconcile",
        type: "PAYMENT_RECONCILE",
        payloadJson: {
          paymentId: "pay_capture",
        },
      }),
    ]);
    const payments = {
      processCancelAuthorizationJob: jest.fn(async () => ({
        paymentId: "pay_auth",
        captureStatus: "CANCELLED",
      })),
      processRefundJob: jest.fn(async () => ({
        paymentId: "pay_capture",
        captureStatus: "REFUNDED",
      })),
      processReconcileJob: jest.fn(async () => ({
        paymentId: "pay_capture",
        captureStatus: "CAPTURED",
      })),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      payments as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 3,
      completed: 3,
      retried: 0,
      dead: 0,
    });
    expect(payments.processCancelAuthorizationJob).toHaveBeenCalledWith(
      "pay_auth",
      "ownership_transfer_failed",
      "payment-cancel:pay_auth:ownership_transfer_failed",
      { beforeProviderSubmission: expect.any(Function) },
    );
    expect(payments.processRefundJob).toHaveBeenCalledWith(
      "pay_capture",
      "event_cancelled",
      "payment-refund:pay_capture:event_cancelled",
      { beforeProviderSubmission: expect.any(Function) },
    );
    expect(payments.processReconcileJob).toHaveBeenCalledWith("pay_capture", {
      beforeProviderSubmission: expect.any(Function),
    });
  });

  it("claims and completes an order match retry after payment authorization", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "ORDER_MATCH_AFTER_PAYMENT_AUTH",
        payloadJson: {
          paymentId: "pay_demo",
          orderId: "ord_buy_demo",
        },
      }),
    ]);
    const orderbook = {
      settleAfterPaymentAuthorization: jest.fn(async () => ({
        orderId: "ord_buy_demo",
        ticketId: "tkt_demo_001",
        tradeId: "trd_demo",
        fulfillmentType: "RESALE",
        matched: true,
        issued: false,
      })),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
    );

    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 1,
      completed: 1,
      retried: 0,
      dead: 0,
    });
    expect(orderbook.settleAfterPaymentAuthorization).toHaveBeenCalledWith(
      "ord_buy_demo",
    );
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        orderId: "ord_buy_demo",
        paymentId: "pay_demo",
        ticketId: "tkt_demo_001",
        tradeId: "trd_demo",
        fulfillmentType: "RESALE",
        matched: true,
        issued: false,
      }),
    });
  });

  it("claims and completes a primary ticket issue after payment authorization", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "ORDER_MATCH_AFTER_PAYMENT_AUTH",
        payloadJson: {
          paymentId: "pay_primary",
          orderId: "ord_primary_buy",
        },
      }),
    ]);
    const orderbook = {
      settleAfterPaymentAuthorization: jest.fn(async () => ({
        orderId: "ord_primary_buy",
        ticketId: "tkt_primary_001",
        tradeId: null,
        fulfillmentType: "PRIMARY",
        matched: false,
        issued: true,
      })),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
    );

    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(orderbook.settleAfterPaymentAuthorization).toHaveBeenCalledWith(
      "ord_primary_buy",
    );
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        orderId: "ord_primary_buy",
        paymentId: "pay_primary",
        ticketId: "tkt_primary_001",
        tradeId: null,
        fulfillmentType: "PRIMARY",
        matched: false,
        issued: true,
      }),
    });
  });
});

class FakeOutbox {
  completed: Array<{ id: string; result: unknown }> = [];
  enqueued: unknown[] = [];
  retried: Array<{ id: string; attempts: number; error: unknown }> = [];
  rescheduled: Array<{ id: string; claimedAttempts: number }> = [];
  submissionStarted: string[] = [];
  recoveredCount = 0;
  recoveredBeforePending = false;
  private recovered = false;

  constructor(private readonly jobs: Array<Record<string, unknown>>) {}

  async recoverStaleProcessingJobs() {
    this.recovered = true;
    return { count: this.recoveredCount };
  }

  async pending() {
    this.recoveredBeforePending = this.recovered;
    return this.jobs;
  }

  async claim(job: Record<string, unknown>) {
    return {
      ...job,
      attempts: Number(job.attempts ?? 0) + 1,
    };
  }

  async assertClaimRevisionCurrent() {
    return undefined;
  }

  async completeJob(job: Record<string, unknown>, result: unknown) {
    const id = String(job.id);
    this.completed.push({ id, result });
    return { ...job, status: "COMPLETED" };
  }

  async markOwnershipSubmissionStarted(job: Record<string, unknown>) {
    const id = String(job.id);
    const current = this.jobs.find((candidate) => candidate.id === id);
    if (!current) {
      return null;
    }
    const payload = current.payloadJson;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    const marked = {
      ...current,
      payloadJson: {
        ...payload,
        [OWNERSHIP_SUBMISSION_STARTED_PAYLOAD_KEY]: true,
      },
      lastError: OWNERSHIP_SUBMISSION_STARTED_MARKER,
    };
    this.submissionStarted.push(id);
    return marked;
  }

  async enqueueStandalone(input: unknown) {
    this.enqueued.push(input);
    return input;
  }

  async retryOrDeadJob(
    job: Record<string, unknown>,
    error: unknown,
    attempts: number,
    maxAttempts = 5,
  ) {
    const id = String(job.id);
    this.retried.push({ id, error, attempts });
    return {
      id,
      status: attempts >= maxAttempts ? "DEAD" : "RETRYING",
    };
  }

  async reschedulePendingReceiptJob(job: Record<string, unknown>) {
    const id = String(job.id);
    const claimedAttempts = Number(job.attempts ?? 0);
    this.rescheduled.push({ id, claimedAttempts });
    return { id, status: "RETRYING" };
  }
}

function fakeJob(overrides: Record<string, unknown>) {
  const now = new Date();
  return {
    id: "sfx_demo",
    type: "OWNERSHIP_TRANSFER",
    status: "PENDING",
    idempotencyKey: "ownership-transfer:buy:sell",
    aggregateType: "trade",
    aggregateId: "buy:sell",
    payloadJson: {},
    attempts: 0,
    lastError: null,
    availableAt: now,
    lockedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
