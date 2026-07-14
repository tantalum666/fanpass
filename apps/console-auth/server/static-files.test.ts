import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { contentType, resolveStaticFile } from "./static-files.js";

test("serves known files and SPA routes from the public boundary", () => {
  const publicDirectory = fixtureDirectory();
  try {
    assert.equal(
      resolveStaticFile(publicDirectory, "/")?.filePath,
      path.join(publicDirectory, "index.html"),
    );
    assert.equal(
      resolveStaticFile(publicDirectory, "/sign-in")?.filePath,
      path.join(publicDirectory, "index.html"),
    );
    assert.equal(
      resolveStaticFile(publicDirectory, "/assets/app-abcdefgh.js")
        ?.cacheControl,
      "public, max-age=31536000, immutable",
    );
  } finally {
    rmSync(publicDirectory, { recursive: true, force: true });
  }
});

test("rejects traversal, malformed encodings, and missing assets", () => {
  const publicDirectory = fixtureDirectory();
  try {
    assert.equal(resolveStaticFile(publicDirectory, "/../outside.txt"), null);
    assert.equal(
      resolveStaticFile(publicDirectory, "/%2e%2e/outside.txt"),
      null,
    );
    assert.equal(resolveStaticFile(publicDirectory, "/%E0%A4%A"), null);
    assert.equal(
      resolveStaticFile(publicDirectory, "/assets/missing.js"),
      null,
    );
  } finally {
    rmSync(publicDirectory, { recursive: true, force: true });
  }
});

test("returns explicit safe content types", () => {
  assert.equal(contentType("index.html"), "text/html; charset=utf-8");
  assert.equal(contentType("app.js"), "text/javascript; charset=utf-8");
  assert.equal(contentType("unknown.bin"), "application/octet-stream");
});

function fixtureDirectory() {
  const publicDirectory = mkdtempSync(
    path.join(tmpdir(), "fanpass-console-auth-static-"),
  );
  mkdirSync(path.join(publicDirectory, "assets"));
  writeFileSync(
    path.join(publicDirectory, "index.html"),
    "<main>FanPass</main>",
  );
  writeFileSync(
    path.join(publicDirectory, "assets/app-abcdefgh.js"),
    "export {};",
  );
  return publicDirectory;
}
