#!/usr/bin/env node
import { createReadStream, createWriteStream } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
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
const readMode = process.env.FANPASS_TURNSTILE_READ_MODE?.trim() || "pyserial";

const seenCredentialKeys = new Set();
let lineBuffer = "";
let sendSerialCommand = null;
let serialProcess = null;
let serialRestartTimer = null;
let stopping = false;

console.log(
  [
    "turnstile_bridge=started",
    `device=${serialDevice}`,
    `api=${new URL(apiBaseUrl).origin}`,
    `gate=${gate}`,
    `baud=${baud}`,
    `auth=${turnstileRedeemKey ? "turnstile_key" : "staff_bearer"}`,
    `read_mode=${readMode}`,
  ].join(" "),
);

startSerialReader();
installShutdownHandlers();

function startSerialReader() {
  try {
    startSerialReaderOnce();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.log(`turnstile_bridge=serial_start_error message=${JSON.stringify(message)}`);
    scheduleSerialRestart("start_error");
  }
}

function startSerialReaderOnce() {
  if (readMode === "direct") {
    configureSerialDevice(serialDevice, baud);
    const stream = createReadStream(serialDevice, {
      encoding: "utf8",
      highWaterMark: 512,
    });
    const writer = createWriteStream(serialDevice, {
      encoding: "utf8",
    });
    sendSerialCommand = (command) => {
      writer.write(`${command}${EOL}`);
    };

    stream.on("data", appendSerialChunk);
    stream.on("error", (error) => {
      console.error(`turnstile_bridge=serial_error message=${JSON.stringify(error.message)}`);
      sendSerialCommand = null;
      stream.destroy();
      writer.destroy();
      scheduleSerialRestart("direct_error");
    });
    return;
  }

  if (readMode === "pyserial") {
    const reader = spawn("python3", [
      "-u",
      "-c",
      [
        "import serial, sys, time",
        "import threading",
        "device = sys.argv[1]",
        "baud = int(sys.argv[2])",
        "ser = serial.Serial(device, baudrate=baud, timeout=1, dsrdtr=False, rtscts=False)",
        "ser.dtr = True",
        "ser.rts = True",
        "time.sleep(0.2)",
        "def stdin_loop():",
        "    for line in sys.stdin:",
        "        if line:",
        "            ser.write(line.encode('utf-8'))",
        "            ser.flush()",
        "threading.Thread(target=stdin_loop, daemon=True).start()",
        "while True:",
        "    data = ser.read(512)",
        "    if data:",
        "        sys.stdout.buffer.write(data)",
        "        sys.stdout.buffer.flush()",
      ].join("\n"),
      serialDevice,
      baud,
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    serialProcess = reader;
    sendSerialCommand = (command) => {
      if (reader.stdin.writable) {
        reader.stdin.write(`${command}\n`);
      }
    };

    reader.stdout.on("data", appendSerialChunk);
    reader.stderr.setEncoding("utf8");
    reader.stderr.on("data", (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line.trim()) {
          console.log(`turnstile_bridge=pyserial message=${JSON.stringify(line.trim())}`);
        }
      }
    });
    reader.on("error", (error) => {
      console.error(`turnstile_bridge=pyserial_error message=${JSON.stringify(error.message)}`);
      sendSerialCommand = null;
      serialProcess = null;
      scheduleSerialRestart("pyserial_error");
    });
    reader.on("exit", (code, signal) => {
      if (signal === "SIGINT") {
        return;
      }
      console.log(`turnstile_bridge=pyserial_exit code=${code ?? "null"} signal=${signal ?? "null"}`);
      sendSerialCommand = null;
      serialProcess = null;
      scheduleSerialRestart("pyserial_exit");
    });
    return;
  }

  const monitor = spawn("arduino-cli", [
    "monitor",
    "-p",
    serialDevice,
    "--config",
    `baudrate=${baud}`,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  monitor.stdout.setEncoding("utf8");
  monitor.stderr.setEncoding("utf8");
  serialProcess = monitor;
  monitor.stdout.on("data", appendSerialChunk);
  monitor.stderr.on("data", (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line.trim()) {
        console.log(`turnstile_bridge=monitor message=${JSON.stringify(line.trim())}`);
      }
    }
  });
  monitor.on("error", (error) => {
    console.error(`turnstile_bridge=monitor_error message=${JSON.stringify(error.message)}`);
    sendSerialCommand = null;
    serialProcess = null;
    scheduleSerialRestart("monitor_error");
  });
  monitor.on("exit", (code, signal) => {
    if (signal === "SIGINT") {
      return;
    }
    console.log(`turnstile_bridge=monitor_exit code=${code ?? "null"} signal=${signal ?? "null"}`);
    sendSerialCommand = null;
    serialProcess = null;
    scheduleSerialRestart("monitor_exit");
  });
}

function scheduleSerialRestart(reason) {
  if (stopping || serialRestartTimer) {
    return;
  }
  console.log(`turnstile_bridge=serial_reconnect_pending reason=${safeToken(reason)} delay_ms=1000`);
  serialRestartTimer = setTimeout(() => {
    serialRestartTimer = null;
    console.log("turnstile_bridge=serial_reconnect_attempt");
    startSerialReader();
  }, 1000);
}

function installShutdownHandlers() {
  const stop = (exitCode) => {
    stopping = true;
    if (serialRestartTimer) {
      clearTimeout(serialRestartTimer);
      serialRestartTimer = null;
    }
    if (serialProcess && !serialProcess.killed) {
      serialProcess.kill("SIGINT");
    }
    process.exit(exitCode);
  };
  process.on("SIGINT", () => {
    stop(130);
  });
  process.on("SIGTERM", () => {
    stop(143);
  });
}

function appendSerialChunk(chunk) {
  lineBuffer += chunk;
  let newlineIndex = findNewline(lineBuffer);
  while (newlineIndex !== -1) {
    const line = lineBuffer.slice(0, newlineIndex).trim();
    lineBuffer = lineBuffer.slice(newlineIndex + 1);
    void handleLine(line);
    newlineIndex = findNewline(lineBuffer);
  }
}

async function handleLine(line) {
  if (!line) {
    return;
  }

  const payload = scanPayloadFromLine(line);
  if (!payload) {
    return;
  }

  console.log("turnstile_bridge=scan_detected");

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

  const credentialKey = body.ticketId || body.credentialId || body.nonce || `${body.eventId}:${body.expiresAt}`;
  if (typeof credentialKey !== "string" || credentialKey.trim().length === 0) {
    console.log("turnstile_bridge=ignored_missing_credential_key");
    sendTurnstileResult("REJECTED", "MISSING_CREDENTIAL");
    return;
  }
  if (seenCredentialKeys.has(credentialKey)) {
    console.log("turnstile_bridge=ignored_duplicate_local_scan");
    sendTurnstileResult("REJECTED", "DUPLICATE_LOCAL");
    return;
  }

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
        [
          "turnstile_bridge=api_rejected",
          `status=${response.status}`,
          `result=${safeToken(responseBody?.result)}`,
          `message=${JSON.stringify(message)}`,
        ].join(" "),
      );
      sendTurnstileResult("REJECTED", responseBody?.result || response.statusText || "API_REJECTED");
      return;
    }

    seenCredentialKeys.add(credentialKey);
    console.log(
      [
        "turnstile_bridge=api_redeemed",
        `ticket=${safeToken(responseBody?.ticketId)}`,
        `result=${safeToken(responseBody?.result)}`,
      ].join(" "),
    );
    sendTurnstileResult("ACCEPTED", responseBody?.result || "ACCEPTED");
  } catch (error) {
    console.log(
      `turnstile_bridge=api_error message=${JSON.stringify(error instanceof Error ? error.message : "unknown error")}`,
    );
    sendTurnstileResult("REJECTED", "API_ERROR");
  }
}

function sendTurnstileResult(status, reason) {
  const safeStatus = safeToken(status).toUpperCase();
  const safeReason = safeToken(reason || "UNKNOWN").toUpperCase();
  const command = `REDEEM_RESULT ${safeStatus} ${safeReason}`;
  if (!sendSerialCommand) {
    console.log(`turnstile_bridge=serial_command_unavailable command=${JSON.stringify(command)}`);
    return;
  }
  sendSerialCommand(command);
  console.log(`turnstile_bridge=serial_command command=${JSON.stringify(command)}`);
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
  FANPASS_TURNSTILE_READ_MODE       pyserial (default), arduino-monitor, or direct
`);
}
