import { expect } from "chai";
import hre from "hardhat";
import path from "path";

import {
  createReviewedBuildManifest,
  type ReviewedBuildArtifact,
} from "../scripts/reviewed-build-manifest.js";

describe("reviewed contract build manifest", () => {
  async function artifacts(): Promise<ReviewedBuildArtifact[]> {
    return Promise.all(
      ["FanPassTicket", "FanPassSoulbound", "RedemptionRegistry"].map(
        async (name) =>
          (await hre.artifacts.readArtifact(name)) as ReviewedBuildArtifact,
      ),
    );
  }

  it("binds current sources, compiler input, ABI, bytecode, config, and lockfile", async () => {
    const packageRoot = path.resolve(import.meta.dirname, "..");
    const manifest = createReviewedBuildManifest({
      packageRoot,
      artifacts: await artifacts(),
    });

    expect(manifest.compiler.solcVersion).to.equal("0.8.28");
    expect(manifest.compiler.inputSha256).to.match(/^sha256:[a-f0-9]{64}$/);
    expect(manifest.compiler.outputSha256).to.match(/^sha256:[a-f0-9]{64}$/);
    expect(manifest.manifestSha256).to.match(/^sha256:[a-f0-9]{64}$/);
    expect(manifest.contracts.FanPassTicket.runtimeBytecodeHash).to.match(
      /^0x[a-f0-9]{64}$/,
    );
    expect(manifest.repositoryInputs.packageLockSha256).to.match(
      /^sha256:[a-f0-9]{64}$/,
    );
  });

  it("fails closed when an artifact is detached from its build info", async () => {
    const packageRoot = path.resolve(import.meta.dirname, "..");
    const currentArtifacts = await artifacts();
    expect(() =>
      createReviewedBuildManifest({
        packageRoot,
        artifacts: [
          { ...currentArtifacts[0], buildInfoId: "missing-build-info" },
          ...currentArtifacts.slice(1),
        ],
      }),
    ).to.throw("share one reviewed build input");

    expect(() =>
      createReviewedBuildManifest({
        packageRoot,
        artifacts: [
          { ...currentArtifacts[0], deployedBytecode: "0x6000" },
          ...currentArtifacts.slice(1),
        ],
      }),
    ).to.throw("runtime bytecode does not match compiler output");

    expect(() =>
      createReviewedBuildManifest({
        packageRoot,
        artifacts: [
          { ...currentArtifacts[0], abi: [] },
          ...currentArtifacts.slice(1),
        ],
      }),
    ).to.throw("ABI does not match compiler output");
  });
});
