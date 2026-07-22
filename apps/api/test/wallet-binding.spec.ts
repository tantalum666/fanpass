import {
  requireVerifiedWalletBinding,
  verifiedWalletBindingOrNull,
  WalletBindingNotVerifiedError,
  walletBindingFingerprint,
} from "../src/common/wallet-binding";

describe("wallet binding provenance", () => {
  const tuple = {
    privyId: "did:privy:fan-demo",
    walletId: "wallet_verified_fan",
    walletAddress: "0x0000000000000000000000000000000000003001",
  };

  it("does not infer trust from populated legacy wallet fields", () => {
    const legacy = {
      privyId: tuple.privyId,
      privyWalletId: tuple.walletId,
      walletAddress: tuple.walletAddress,
      walletBindingStatus: "UNVERIFIED" as const,
      walletBindingVerifiedAt: null,
      walletBindingVersion: 0,
      walletBindingFingerprint: null,
    };

    expect(verifiedWalletBindingOrNull(legacy)).toBeNull();
    expect(() => requireVerifiedWalletBinding(legacy, "Buyer wallet")).toThrow(
      WalletBindingNotVerifiedError,
    );
  });

  it("accepts only a complete verified tuple with a matching fingerprint", () => {
    const verified = {
      privyId: tuple.privyId,
      privyWalletId: tuple.walletId,
      walletAddress: tuple.walletAddress,
      walletBindingStatus: "VERIFIED" as const,
      walletBindingVerifiedAt: "2026-07-20T00:00:00.000Z",
      walletBindingVersion: 3,
      walletBindingFingerprint: walletBindingFingerprint(tuple),
    };

    expect(requireVerifiedWalletBinding(verified)).toEqual({
      ...verified,
      walletBindingVerifiedAt: "2026-07-20T00:00:00.000Z",
    });
    expect(
      verifiedWalletBindingOrNull({
        ...verified,
        walletAddress: "0x0000000000000000000000000000000000003999",
      }),
    ).toBeNull();
  });

  it("normalizes the provider address before deriving the tuple fingerprint", () => {
    expect(
      walletBindingFingerprint({
        ...tuple,
        walletAddress: tuple.walletAddress.toUpperCase().replace("0X", "0x"),
      }),
    ).toBe(walletBindingFingerprint(tuple));
  });
});
