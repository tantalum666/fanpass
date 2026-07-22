import { createHash } from "crypto";
import type { WalletBindingStatus } from "./domain";

const WALLET_BINDING_FINGERPRINT_VERSION = "fanpass-wallet-binding-v1";
const WALLET_BINDING_PROVIDER = "privy";
const ETHEREUM_ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

export interface VerifiedWalletBinding {
  privyId: string;
  privyWalletId: string;
  walletAddress: string;
  walletBindingStatus: "VERIFIED";
  walletBindingVerifiedAt: string;
  walletBindingVersion: number;
  walletBindingFingerprint: string;
}

export interface WalletBindingRecord {
  privyId?: string | null;
  privyWalletId?: string | null;
  walletAddress?: string | null;
  walletBindingStatus?: WalletBindingStatus;
  walletBindingVerifiedAt?: string | Date | null;
  walletBindingVersion?: number;
  walletBindingFingerprint?: string | null;
}

export class WalletBindingNotVerifiedError extends Error {
  readonly code = "WALLET_BINDING_NOT_VERIFIED";

  constructor(label = "Wallet") {
    super(`${label} is not verified for custody`);
    this.name = "WalletBindingNotVerifiedError";
  }
}

export function walletBindingFingerprint(input: {
  privyId: string;
  walletId: string;
  walletAddress: string;
}) {
  const privyId = requiredTrimmed(input.privyId, "Privy subject");
  const walletId = requiredTrimmed(input.walletId, "Privy wallet ID");
  const walletAddress = normalizedEthereumAddress(input.walletAddress);
  return createHash("sha256")
    .update(
      [
        WALLET_BINDING_FINGERPRINT_VERSION,
        WALLET_BINDING_PROVIDER,
        privyId,
        walletId,
        walletAddress,
      ].join("\0"),
    )
    .digest("hex");
}

export function verifiedWalletBindingOrNull(
  record: WalletBindingRecord,
): VerifiedWalletBinding | null {
  if (bindingStatus(record.walletBindingStatus) !== "VERIFIED") {
    return null;
  }
  const privyId = record.privyId?.trim() ?? "";
  const privyWalletId = record.privyWalletId?.trim() ?? "";
  const walletAddress = record.walletAddress?.trim().toLowerCase() ?? "";
  const verifiedAt = normalizedVerifiedAt(record.walletBindingVerifiedAt);
  const version = record.walletBindingVersion ?? 0;
  const fingerprint =
    record.walletBindingFingerprint?.trim().toLowerCase() ?? "";
  if (
    !privyId ||
    !privyWalletId ||
    !ETHEREUM_ADDRESS_PATTERN.test(walletAddress) ||
    !verifiedAt ||
    !Number.isSafeInteger(version) ||
    version <= 0 ||
    !FINGERPRINT_PATTERN.test(fingerprint)
  ) {
    return null;
  }
  if (
    fingerprint !==
    walletBindingFingerprint({
      privyId,
      walletId: privyWalletId,
      walletAddress,
    })
  ) {
    return null;
  }
  return {
    privyId,
    privyWalletId,
    walletAddress,
    walletBindingStatus: "VERIFIED",
    walletBindingVerifiedAt: verifiedAt,
    walletBindingVersion: version,
    walletBindingFingerprint: fingerprint,
  };
}

export function requireVerifiedWalletBinding(
  record: WalletBindingRecord,
  label = "Wallet",
) {
  const binding = verifiedWalletBindingOrNull(record);
  if (!binding) {
    throw new WalletBindingNotVerifiedError(label);
  }
  return binding;
}

function bindingStatus(value: WalletBindingStatus | undefined) {
  return value ?? "UNVERIFIED";
}

function normalizedVerifiedAt(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizedEthereumAddress(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!ETHEREUM_ADDRESS_PATTERN.test(normalized)) {
    throw new Error("Privy wallet address is invalid");
  }
  return normalized;
}

function requiredTrimmed(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}
