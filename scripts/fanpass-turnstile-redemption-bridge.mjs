#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { spawnSync } from "node:child_process";
import { EOL, platform } from "node:os";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const serialDevice = readRequiredEnv("FANPASS_TURNSTILE_SERIAL_DEVICE");
const apiBaseUrl = normalizeBaseUrl(readRequiredEnv("FANPASS_API_BASE_URL"));
const turnstileRedeemKey = process.env.FANPASS_TURNSTILE_REDEEM_KEY?.trim() || "";
const staffAccessToken = process.env.FANPASS_STAFF_ACCESS_TOKEN?.trim() || "";
if (!turnstileRedeemKey && !staffAccessToken) {
  throw new Error("FANPASS_TURNSTILE_REDEEM_KEY or FANPASS_STAFF_ACCESS_TOKEN is required");
}
const gate = process.env.FANPASS_TURNSTILE_GATE?.trim() || "GATE-A";
const baud = process.env.FANPASS_TURNSTILE_BAUD?.trim() || "115200";

const seenCredentialKeys = new Set();
let lineBuffer = "";

configureSerialDevice(serialDevice, baud);

console.log(
  [
    "turnstile_bridge=started",
    `device=${serialDevice}`,
    `api=${new URL(apiBaseUrl).origin}`,
    `gate=${gate}`,
    `baud=${baud}`,
    `auth=${turnstileRedeemKey ? "turnstile_key" : "staff_bearer"}`,
  ].join(" "),
);

const stream = createReadStream(serialDevice, {
  encoding: "utf8",
  highWaterMark: 512,
});

stream.on("data", (chunk) => {
  lineBuffer += chunk;
  let newlineIndex = findNewline(lineBuffer);
  while (newlineIndex !== -1) {
    const line = lineBuffer.slice(0, newlineIndex).trim();
    lineBuffer = lineBuffer.slice(newlineIndex + 1);
    void handleLine(line);
    newlineIndex = findNewline(lineBuffer);
  }
});

stream.on("error", (error) => {
  console.error(`turnstile_bridge=serial_error message=${JSON.stringify(error.message)}`);
  process.exitCode = 1;
});

async function handleLine(line) {
  if (!line) {
    return;
  }

  const payload = scanPayloadFromLine(line);
  if (!payload) {
    return;
  }

  if (payload === "EP8280:DECODE_PIN") {
    console.log("turnstile_bridge=ignored_decode_fallback");
    return;
  }

  let body;
  try {
    body = JSON.parse(payload);
  } catch {
    console.log("turnstile_bridge=ignored_non_json_scan");
    return;
  }

  const credentialKey = body.credentialId || body.nonce || `${body.ticketId}:${body.expiresAt}`;
  if (typeof credentialKey !== "string" || credentialKey.trim().length === 0) {
    console.log("turnstile_bridge=ignored_missing_credential_key");
    return;
  }
  if (seenCredentialKeys.has(credentialKey)) {
    console.log("turnstile_bridge=ignored_duplicate_local_scan");
    return;
  }
  seenCredentialKeys.add(credentialKey);

  try {
    const response = await fetch(`${apiBaseUrl}${redeemPath()}`, {
      method: "POST",
      headers: redeemHeaders(),
      body: JSON.stringify({
        ...body,
        gate,
      }),
    });

    const responseText = await response.text();
    const responseBody = parseJson(responseText);
    if (!response.ok) {
      const message =
        responseBody?.message ||
        responseBody?.error ||
        response.statusText ||
        "redemption rejected";
      console.log(
        `turnstile_bridge=api_rejected status=${response.status} message=${JSON.stringify(message)}`,
      );
      return;
    }

    console.log(
      [
        "turnstile_bridge=api_redeemed",
        `ticket=${safeToken(responseBody?.ticketId)}`,
        `result=${safeToken(responseBody?.result)}`,
      ].join(" "),
    );
  } catch (error) {
    console.log(
      `turnstile_bridge=api_error message=${JSON.stringify(error instanceof Error ? error.message : "unknown error")}`,
    );
  }
}

function scanPayloadFromLine(line) {
  const marker = "SCAN:";
  const index = line.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return line.slice(index + marker.length).trim();
}

function configureSerialDevice(device, selectedBaud) {
  const command = platform() === "darwin" ? "stty" : "stty";
  const args =
    platform() === "darwin"
      ? ["-f", device, selectedBaud, "raw", "-echo"]
      : ["-F", device, selectedBaud, "raw", "-echo"];
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join(EOL).trim();
    throw new Error(`Could not configure serial device ${device}: ${detail}`);
  }
}

function normalizeBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, "");
  const url = new URL(trimmed);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("FANPASS_API_BASE_URL must be http or https");
  }
  return url.toString().replace(/\/+$/, "");
}

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function redeemPath() {
  return turnstileRedeemKey
    ? "/verification/turnstile/redeem"
    : "/verification/redeem";
}

function redeemHeaders() {
  const headers = {
    "content-type": "application/json",
  };
  if (turnstileRedeemKey) {
    headers["x-fanpass-turnstile-key"] = turnstileRedeemKey;
  } else {
    headers.authorization = `Bearer ${staffAccessToken}`;
  }
  return headers;
}

function findNewline(value) {
  const lf = value.indexOf("\n");
  const cr = value.indexOf("\r");
  if (lf === -1) {
    return cr;
  }
  if (cr === -1) {
    return lf;
  }
  return Math.min(lf, cr);
}

function parseJson(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function safeToken(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "unknown";
  }
  return value.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 96);
}

function printHelp() {
  console.log(`FanPass turnstile redemption bridge

Reads Arduino Serial lines like "SCAN: { ...signed QR JSON... }" and posts them
to FanPass API redemption endpoints. Secrets are read only from environment.

Required environment:
  FANPASS_TURNSTILE_SERIAL_DEVICE   Serial device, for example /dev/cu.usbmodemXXXX
  FANPASS_API_BASE_URL              FanPass API base URL
  FANPASS_TURNSTILE_REDEEM_KEY      Hardware key for /verification/turnstile/redeem
    or
  FANPASS_STAFF_ACCESS_TOKEN        Staff/admin bearer token for /verification/redeem

Optional environment:
  FANPASS_TURNSTILE_GATE            Gate code, default GATE-A
  FANPASS_TURNSTILE_BAUD            Serial baud, default 115200
`);
}
