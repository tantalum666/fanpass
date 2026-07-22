import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { keccak256, type InterfaceAbi } from "ethers";

export interface ReviewedBuildArtifact {
  contractName: string;
  sourceName: string;
  buildInfoId: string;
  abi: InterfaceAbi;
  bytecode: string;
  deployedBytecode: string;
}

export interface ReviewedBuildManifest {
  schemaVersion: 1;
  compiler: {
    buildInfoId: string;
    solcVersion: string;
    solcLongVersion: string;
    inputSha256: string;
    outputSha256: string;
  };
  repositoryInputs: {
    hardhatConfigSha256: string;
    packageJsonSha256: string;
    packageLockSha256: string;
  };
  contracts: Record<
    string,
    {
      sourceName: string;
      sourceSha256: string;
      abiSha256: string;
      creationBytecodeHash: string;
      runtimeBytecodeHash: string;
    }
  >;
  manifestSha256: string;
}

interface HardhatBuildInfo {
  id: string;
  solcVersion: string;
  solcLongVersion: string;
  userSourceNameMap: Record<string, string>;
  input: {
    sources: Record<string, { content: string }>;
    [key: string]: unknown;
  };
}

interface HardhatBuildOutput {
  id: string;
  output: {
    contracts: Record<
      string,
      Record<
        string,
        {
          abi: InterfaceAbi;
          evm: {
            bytecode: { object: string };
            deployedBytecode: { object: string };
          };
        }
      >
    >;
  };
}

export function createReviewedBuildManifest(options: {
  packageRoot: string;
  artifacts: ReviewedBuildArtifact[];
}): ReviewedBuildManifest {
  if (options.artifacts.length === 0) {
    throw new Error("Reviewed build manifest requires contract artifacts.");
  }
  const buildInfoIds = new Set(
    options.artifacts.map((artifact) => artifact.buildInfoId),
  );
  if (buildInfoIds.size !== 1) {
    throw new Error("Contract artifacts must share one reviewed build input.");
  }
  const [buildInfoId] = [...buildInfoIds];
  if (!/^[a-zA-Z0-9_-]+$/.test(buildInfoId)) {
    throw new Error("Contract artifact build info id is invalid.");
  }

  const buildInfoPath = path.join(
    options.packageRoot,
    "artifacts",
    "build-info",
    `${buildInfoId}.json`,
  );
  const buildInfo = JSON.parse(
    fs.readFileSync(buildInfoPath, "utf8"),
  ) as HardhatBuildInfo;
  if (buildInfo.id !== buildInfoId) {
    throw new Error("Build info id does not match the contract artifacts.");
  }
  const buildOutput = JSON.parse(
    fs.readFileSync(
      path.join(
        options.packageRoot,
        "artifacts",
        "build-info",
        `${buildInfoId}.output.json`,
      ),
      "utf8",
    ),
  ) as HardhatBuildOutput;
  if (buildOutput.id !== buildInfoId) {
    throw new Error("Build output id does not match the contract artifacts.");
  }

  const contracts: ReviewedBuildManifest["contracts"] = {};
  for (const artifact of options.artifacts) {
    const inputSourceName = buildInfo.userSourceNameMap[artifact.sourceName];
    const compiledSource = inputSourceName
      ? buildInfo.input.sources[inputSourceName]?.content
      : undefined;
    const sourcePath = path.join(options.packageRoot, artifact.sourceName);
    const currentSource = fs.readFileSync(sourcePath, "utf8");
    if (compiledSource === undefined || compiledSource !== currentSource) {
      throw new Error(
        `${artifact.contractName} artifact is stale relative to current source.`,
      );
    }
    const compiledContract = inputSourceName
      ? buildOutput.output.contracts[inputSourceName]?.[artifact.contractName]
      : undefined;
    if (!compiledContract) {
      throw new Error(
        `${artifact.contractName} is missing from its compiler output.`,
      );
    }
    if (stableJson(artifact.abi) !== stableJson(compiledContract.abi)) {
      throw new Error(
        `${artifact.contractName} ABI does not match compiler output.`,
      );
    }
    if (
      artifact.bytecode.toLowerCase() !==
      `0x${compiledContract.evm.bytecode.object}`.toLowerCase()
    ) {
      throw new Error(
        `${artifact.contractName} creation bytecode does not match compiler output.`,
      );
    }
    if (
      artifact.deployedBytecode.toLowerCase() !==
      `0x${compiledContract.evm.deployedBytecode.object}`.toLowerCase()
    ) {
      throw new Error(
        `${artifact.contractName} runtime bytecode does not match compiler output.`,
      );
    }
    if (!artifact.bytecode || artifact.bytecode === "0x") {
      throw new Error(`${artifact.contractName} creation bytecode is missing.`);
    }
    if (!artifact.deployedBytecode || artifact.deployedBytecode === "0x") {
      throw new Error(`${artifact.contractName} runtime bytecode is missing.`);
    }
    contracts[artifact.contractName] = {
      sourceName: artifact.sourceName,
      sourceSha256: sha256(currentSource),
      abiSha256: sha256(stableJson(artifact.abi)),
      creationBytecodeHash: keccak256(artifact.bytecode),
      runtimeBytecodeHash: keccak256(artifact.deployedBytecode),
    };
  }

  const manifestWithoutDigest = {
    schemaVersion: 1 as const,
    compiler: {
      buildInfoId,
      solcVersion: buildInfo.solcVersion,
      solcLongVersion: buildInfo.solcLongVersion,
      inputSha256: sha256(stableJson(buildInfo.input)),
      outputSha256: sha256(stableJson(buildOutput.output)),
    },
    repositoryInputs: {
      hardhatConfigSha256: sha256(
        fs.readFileSync(path.join(options.packageRoot, "hardhat.config.ts")),
      ),
      packageJsonSha256: sha256(
        fs.readFileSync(path.join(options.packageRoot, "package.json")),
      ),
      packageLockSha256: sha256(
        fs.readFileSync(
          path.resolve(options.packageRoot, "..", "..", "package-lock.json"),
        ),
      ),
    },
    contracts,
  };

  return {
    ...manifestWithoutDigest,
    manifestSha256: sha256(stableJson(manifestWithoutDigest)),
  };
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
