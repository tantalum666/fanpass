import { expect } from "chai";

import {
  assertLocalDeploymentNetwork,
  assertSepoliaDeploymentNetwork,
  assertSepoliaStagingPreflightIsKeyless,
  assertSepoliaStagingDeploymentNetwork,
  initializeHardhatEnvironment,
  isHardhatProcessOnlyEnvironmentKey,
  requireSepoliaStagingPreflightConfig,
  resolveSepoliaDevCredentials,
  resolveSepoliaStagingMigrationConfig,
  SEPOLIA_STAGING_MIGRATION_OPT_IN,
} from "../scripts/deployment-policy.js";

describe("deployment policy", () => {
  const temporaryPrivateKey = "11".repeat(32);
  const validSepoliaEnvironment = {
    FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY: "true",
    FANPASS_SEPOLIA_RPC_URL: "https://rpc.example.test/sepolia",
    FANPASS_SEPOLIA_DEV_PRIVATE_KEY: temporaryPrivateKey,
  };

  describe("Hardhat local environment loading", () => {
    it("decides protected modes before local files and never loads them", () => {
      for (const protectedFlags of [
        { FANPASS_HARDHAT_READ_ONLY_PREFLIGHT: "true" },
        { FANPASS_HARDHAT_STAGING_MIGRATION: "true" },
      ]) {
        const environment: Record<string, string | undefined> = {
          ...protectedFlags,
        };
        const loaded: string[] = [];
        const policy = initializeHardhatEnvironment({
          environment,
          localEnvFiles: ["root/.env.local", "package/.env.local"],
          loadLocalEnvFile: (filePath) => {
            loaded.push(filePath);
            environment.FANPASS_SEPOLIA_DEV_PRIVATE_KEY =
              "must-never-be-imported";
          },
        });
        expect(policy.localEnvFilesAllowed).to.equal(false);
        expect(loaded).to.deep.equal([]);
        expect(environment.FANPASS_SEPOLIA_DEV_PRIVATE_KEY).to.equal(undefined);
      }
    });

    it("preserves ordinary local/dev env loading and rejects conflicting protected modes", () => {
      const environment: Record<string, string | undefined> = {};
      const loaded: string[] = [];
      const policy = initializeHardhatEnvironment({
        environment,
        localEnvFiles: ["root/.env.local", "package/.env.local"],
        loadLocalEnvFile: (filePath) => {
          loaded.push(filePath);
          environment.FANPASS_SEPOLIA_DEV_PRIVATE_KEY = "ordinary-dev-key";
        },
      });
      expect(policy).to.deep.equal({
        mode: "STANDARD",
        localEnvFilesAllowed: true,
      });
      expect(loaded).to.deep.equal(["root/.env.local", "package/.env.local"]);
      expect(environment.FANPASS_SEPOLIA_DEV_PRIVATE_KEY).to.equal(
        "ordinary-dev-key",
      );

      expect(() =>
        initializeHardhatEnvironment({
          environment: {
            FANPASS_HARDHAT_READ_ONLY_PREFLIGHT: "true",
            FANPASS_HARDHAT_STAGING_MIGRATION: "true",
          },
          localEnvFiles: ["must-not-load"],
          loadLocalEnvFile: () => {
            throw new Error("local env loader must not run");
          },
        }),
      ).to.throw("mutually exclusive");
      expect(
        isHardhatProcessOnlyEnvironmentKey(
          "FANPASS_HARDHAT_READ_ONLY_PREFLIGHT",
        ),
      ).to.equal(true);
      expect(
        isHardhatProcessOnlyEnvironmentKey("FANPASS_SEPOLIA_RPC_URL"),
      ).to.equal(false);
    });
  });

  describe("local deployment", () => {
    it("accepts only the explicit Hardhat simulation on chain 31337", () => {
      expect(() =>
        assertLocalDeploymentNetwork({
          networkName: "hardhat",
          chainId: 31337n,
        }),
      ).not.to.throw();

      expect(() =>
        assertLocalDeploymentNetwork({
          networkName: "sepoliaDev",
          chainId: 11155111n,
        }),
      ).to.throw("hardhat");
      expect(() =>
        assertLocalDeploymentNetwork({
          networkName: "hardhat",
          chainId: 11155111n,
        }),
      ).to.throw("31337");
    });
  });

  describe("Sepolia development deployment", () => {
    it("accepts only the dedicated network name and Sepolia chain id", () => {
      expect(() =>
        assertSepoliaDeploymentNetwork({
          networkName: "sepoliaDev",
          chainId: 11155111n,
        }),
      ).not.to.throw();

      expect(() =>
        assertSepoliaDeploymentNetwork({
          networkName: "hardhat",
          chainId: 31337n,
        }),
      ).to.throw("sepoliaDev");
      expect(() =>
        assertSepoliaDeploymentNetwork({
          networkName: "sepoliaDev",
          chainId: 1n,
        }),
      ).to.throw("11155111");
    });

    it("requires the exact opt-in before loading a configured account", () => {
      for (const optIn of [undefined, "", "TRUE", "1", "yes"]) {
        expect(
          resolveSepoliaDevCredentials({
            ...validSepoliaEnvironment,
            FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY: optIn,
          }),
        ).to.equal(null);
      }

      expect(
        resolveSepoliaDevCredentials(validSepoliaEnvironment),
      ).to.deep.equal({
        rpcUrl: "https://rpc.example.test/sepolia",
        privateKey: `0x${temporaryPrivateKey}`,
      });
    });

    it("rejects non-HTTPS RPC endpoints and malformed temporary keys", () => {
      expect(() =>
        resolveSepoliaDevCredentials({
          ...validSepoliaEnvironment,
          FANPASS_SEPOLIA_RPC_URL: "http://rpc.example.test/sepolia",
        }),
      ).to.throw("HTTPS");
      expect(() =>
        resolveSepoliaDevCredentials({
          ...validSepoliaEnvironment,
          FANPASS_SEPOLIA_RPC_URL: "not-a-url",
        }),
      ).to.throw("HTTPS");
      expect(() =>
        resolveSepoliaDevCredentials({
          ...validSepoliaEnvironment,
          FANPASS_SEPOLIA_DEV_PRIVATE_KEY: "0x1234",
        }),
      ).to.throw("temporary Sepolia-only private key");
    });
  });

  describe("Sepolia staging migration", () => {
    const sponsorAddress = "0x1000000000000000000000000000000000000001";
    const stagingEnvironment = {
      FANPASS_ALLOW_SEPOLIA_STAGING_MIGRATION: SEPOLIA_STAGING_MIGRATION_OPT_IN,
      FANPASS_SEPOLIA_RPC_URL: "https://rpc.example.test/sepolia",
      FANPASS_SEPOLIA_STAGING_TEMP_PRIVATE_KEY: temporaryPrivateKey,
      FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS: sponsorAddress,
    };

    it("accepts only the dedicated staging network and Sepolia chain", () => {
      expect(() =>
        assertSepoliaStagingDeploymentNetwork({
          networkName: "sepoliaStaging",
          chainId: 11155111n,
        }),
      ).not.to.throw();
      expect(() =>
        assertSepoliaStagingDeploymentNetwork({
          networkName: "sepoliaDev",
          chainId: 11155111n,
        }),
      ).to.throw("sepoliaStaging");
      expect(() =>
        assertSepoliaStagingDeploymentNetwork({
          networkName: "sepoliaStaging",
          chainId: 1n,
        }),
      ).to.throw("11155111");
    });

    it("requires the exact staging migration opt-in", () => {
      for (const optIn of [undefined, "", "true", "1", "yes"]) {
        expect(
          resolveSepoliaStagingMigrationConfig({
            ...stagingEnvironment,
            FANPASS_ALLOW_SEPOLIA_STAGING_MIGRATION: optIn,
          }),
        ).to.equal(null);
      }

      const config = resolveSepoliaStagingMigrationConfig(stagingEnvironment);
      expect(config).to.deep.include({
        rpcUrl: stagingEnvironment.FANPASS_SEPOLIA_RPC_URL,
        privateKey: `0x${temporaryPrivateKey}`,
        sponsorAddress,
      });
    });

    it("rejects an invalid sponsor, unsafe RPC, malformed key, and sponsor equal to deployer", () => {
      expect(() =>
        resolveSepoliaStagingMigrationConfig({
          ...stagingEnvironment,
          FANPASS_SEPOLIA_RPC_URL: "http://rpc.example.test/sepolia",
        }),
      ).to.throw("HTTPS");
      expect(() =>
        resolveSepoliaStagingMigrationConfig({
          ...stagingEnvironment,
          FANPASS_SEPOLIA_STAGING_TEMP_PRIVATE_KEY: "0x1234",
        }),
      ).to.throw("temporary Sepolia-only private key");
      expect(() =>
        resolveSepoliaStagingMigrationConfig({
          ...stagingEnvironment,
          FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS: "not-an-address",
        }),
      ).to.throw("Privy sponsor");
      expect(() =>
        resolveSepoliaStagingMigrationConfig({
          ...stagingEnvironment,
          FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS:
            "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
        }),
      ).to.throw("must be different");
      expect(() =>
        resolveSepoliaStagingMigrationConfig({
          ...stagingEnvironment,
          FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY: "true",
        }),
      ).to.throw("Disable FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY");
      expect(() =>
        resolveSepoliaStagingMigrationConfig({
          ...stagingEnvironment,
          FANPASS_SEPOLIA_DEV_PRIVATE_KEY: "unrelated-dev-key",
        }),
      ).to.throw("isolated Staging migration process");
    });

    it("requires a genuinely keyless cutover preflight environment", () => {
      expect(() => assertSepoliaStagingPreflightIsKeyless({})).not.to.throw();
      for (const key of [
        "FANPASS_SEPOLIA_STAGING_TEMP_PRIVATE_KEY",
        "FANPASS_SEPOLIA_DEV_PRIVATE_KEY",
        "TESTNET_OPERATOR_PRIVATE_KEY",
        "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY",
      ]) {
        expect(() =>
          assertSepoliaStagingPreflightIsKeyless({ [key]: "secret" }),
        ).to.throw("must be unset");
      }
      expect(() =>
        assertSepoliaStagingPreflightIsKeyless({
          FANPASS_ALLOW_SEPOLIA_STAGING_MIGRATION:
            SEPOLIA_STAGING_MIGRATION_OPT_IN,
        }),
      ).to.throw("opt-ins");
    });

    it("binds cutover preflight to the protected migration build digest", () => {
      const preflightEnvironment = {
        FANPASS_SEPOLIA_RPC_URL: stagingEnvironment.FANPASS_SEPOLIA_RPC_URL,
        FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS: sponsorAddress,
        FANPASS_SEPOLIA_STAGING_TICKET_ADDRESS:
          "0x2000000000000000000000000000000000000002",
        FANPASS_SEPOLIA_STAGING_SOULBOUND_ADDRESS:
          "0x3000000000000000000000000000000000000003",
        FANPASS_SEPOLIA_STAGING_REDEMPTION_REGISTRY_ADDRESS:
          "0x4000000000000000000000000000000000000004",
        FANPASS_SEPOLIA_STAGING_POLICY_PROBE_TICKET_ID_HASH: `0x${"ab".repeat(32)}`,
        FANPASS_SEPOLIA_STAGING_EXPECTED_BUILD_MANIFEST_SHA256: `sha256:${"cd".repeat(32)}`,
      };
      expect(
        requireSepoliaStagingPreflightConfig(preflightEnvironment),
      ).to.deep.include({
        sponsorAddress,
        expectedBuildManifestSha256: `sha256:${"cd".repeat(32)}`,
      });
      expect(() =>
        requireSepoliaStagingPreflightConfig({
          ...preflightEnvironment,
          FANPASS_SEPOLIA_STAGING_EXPECTED_BUILD_MANIFEST_SHA256: "stale",
        }),
      ).to.throw("protected migration build digest");
    });
  });
});
