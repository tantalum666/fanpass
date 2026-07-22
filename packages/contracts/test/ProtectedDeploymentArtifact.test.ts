import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

import {
  protectedArtifactLabel,
  redactAddress,
  redactDigest,
  redactHash,
  writeProtectedDeploymentArtifact,
} from "../scripts/protected-deployment-artifact.js";

describe("protected deployment artifacts", () => {
  it("writes an atomic gitignored-path artifact with mode 0600", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "fanpass-artifact-"));
    try {
      const artifactPath = writeProtectedDeploymentArtifact({
        rootDir,
        prefix: "sepolia-staging-migration",
        artifact: { ok: true, publicChainDataOnly: true },
        now: new Date("2026-07-20T00:00:00.000Z"),
      });

      expect(artifactPath).to.include(
        path.join(".fanpass-local", "chain-staging"),
      );
      expect(fs.statSync(artifactPath).mode & 0o777).to.equal(0o600);
      expect(fs.statSync(path.dirname(artifactPath)).mode & 0o777).to.equal(
        0o700,
      );
      expect(JSON.parse(fs.readFileSync(artifactPath, "utf8"))).to.deep.equal({
        ok: true,
        publicChainDataOnly: true,
      });
      expect(protectedArtifactLabel(artifactPath)).not.to.include(rootDir);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("redacts addresses and hashes for console-safe summaries", () => {
    expect(
      redactAddress("0x1000000000000000000000000000000000000001"),
    ).to.equal("0x100000...000001");
    expect(redactAddress("secret")).to.equal("[invalid-address-redacted]");
    expect(redactHash(`0x${"12".repeat(32)}`)).to.equal(
      "0x12121212...12121212",
    );
    expect(redactHash("secret")).to.equal("[invalid-hash-redacted]");
    expect(redactDigest(`sha256:${"ab".repeat(32)}`)).to.equal(
      "sha256:abababab...abababab",
    );
    expect(redactDigest("secret")).to.equal("[invalid-digest-redacted]");
  });

  it("rejects path traversal prefixes and confirms the real repository ignores artifacts", () => {
    const rootDir = path.resolve(import.meta.dirname, "..", "..", "..");
    expect(() =>
      writeProtectedDeploymentArtifact({
        rootDir,
        prefix: "../escape",
        artifact: { ok: false },
      }),
    ).to.throw("prefix is invalid");

    const ignored = spawnSync(
      "git",
      ["check-ignore", "-q", ".fanpass-local/chain-staging/probe.json"],
      { cwd: rootDir },
    );
    expect(ignored.status).to.equal(0);
  });
});
