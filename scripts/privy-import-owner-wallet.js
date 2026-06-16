const fs = require("fs");
const path = require("path");
const { Wallet } = require("ethers");

const rootDir = path.resolve(__dirname, "..");
const envFile = process.env.FANPASS_PRIVY_IMPORT_ENV_FILE
  ? path.resolve(process.env.FANPASS_PRIVY_IMPORT_ENV_FILE)
  : path.join(rootDir, "apps/api/.env");
const outputDir = path.join(rootDir, ".fanpass-local/privy");
const outputFile = path.join(outputDir, "imported-owner-wallet.json");

const fileEnv = readEnvFile(envFile);
const dryRun = process.argv.includes("--dry-run");

main().catch((error) => {
  console.error(cleanError(error));
  process.exit(1);
});

async function main() {
  const appId = read("PRIVY_APP_ID") ?? (await promptPlain("Privy app id: "));
  const appSecret =
    read("PRIVY_APP_SECRET") ?? (await promptHidden("Privy app secret: "));
  const privateKey =
    read("FANPASS_PRIVY_IMPORT_PRIVATE_KEY") ??
    (await promptHidden("Owner wallet private key: "));

  if (!appId) {
    throw new Error("PRIVY_APP_ID is required");
  }
  if (!appSecret) {
    throw new Error("PRIVY_APP_SECRET is required");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("Owner wallet private key must be a 0x-prefixed 32-byte key");
  }

  const wallet = new Wallet(privateKey);
  const address = wallet.address;

  if (dryRun) {
    const encrypted = await encryptPrivateKeyForPrivy({
      encryptionPublicKey: await fixtureEncryptionPublicKey(),
      privateKey,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          address: shortAddress(address),
          encryptedShape: {
            encryption_type: "HPKE",
            encapsulated_key: encrypted.encapsulated_key.length,
            ciphertext: encrypted.ciphertext.length,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const init = await privyRequest({
    appId,
    appSecret,
    path: "/v1/wallets/import/init",
    body: {
      address,
      chain_type: "ethereum",
      entropy_type: "private-key",
      encryption_type: "HPKE",
    },
  });

  if (init.encryption_type !== "HPKE" || !init.encryption_public_key) {
    throw new Error("Privy import init did not return an HPKE public key");
  }

  const encrypted = await encryptPrivateKeyForPrivy({
    encryptionPublicKey: init.encryption_public_key,
    privateKey,
  });

  const body = {
    wallet: {
      address,
      chain_type: "ethereum",
      entropy_type: "private-key",
      encryption_type: "HPKE",
      encapsulated_key: encrypted.encapsulated_key,
      ciphertext: encrypted.ciphertext,
      display_name: read("FANPASS_PRIVY_IMPORT_DISPLAY_NAME") ?? "FanPass Sepolia Owner",
      external_id: read("FANPASS_PRIVY_IMPORT_EXTERNAL_ID") ?? "fanpass-sepolia-owner",
    },
  };
  const ownerId = read("FANPASS_PRIVY_IMPORT_OWNER_ID");
  if (ownerId) {
    body.owner_id = ownerId;
  }

  const imported = await privyRequest({
    appId,
    appSecret,
    path: "/v1/wallets/import/submit",
    body,
  });

  const result = {
    importedAt: new Date().toISOString(),
    walletId: imported.id,
    address: imported.address,
    chainType: imported.chain_type,
    ownerId: imported.owner_id ?? null,
    displayName: imported.display_name ?? null,
    externalId: imported.external_id ?? null,
  };

  if (!result.walletId || !result.address) {
    throw new Error("Privy import submit succeeded but did not return wallet id/address");
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        walletId: result.walletId,
        address: result.address,
        outputFile: shortPath(outputFile),
      },
      null,
      2,
    ),
  );
}

async function privyRequest({ appId, appSecret, path: requestPath, body }) {
  const response = await fetch(`${apiBaseUrl()}${requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
      "privy-app-id": appId,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      readString(payload?.error) ??
        readString(payload?.message) ??
        `Privy import request failed with HTTP ${response.status}`,
    );
  }
  return payload;
}

async function encryptPrivateKeyForPrivy({ encryptionPublicKey, privateKey }) {
  const { CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } = await import(
    "@hpke/core"
  );
  const { Chacha20Poly1305 } = await import("@hpke/chacha20poly1305");
  const suite = new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });
  const recipientPublicKey = await suite.kem.deserializePublicKey(
    Buffer.from(encryptionPublicKey, "base64"),
  );
  const sender = await suite.createSenderContext({ recipientPublicKey });
  const privateKeyBytes = Buffer.from(privateKey.replace(/^0x/i, ""), "hex");
  if (privateKeyBytes.length !== 32) {
    throw new Error("Owner wallet private key must decode to 32 raw bytes");
  }
  const ciphertext = await sender.seal(privateKeyBytes);
  return {
    encapsulated_key: Buffer.from(sender.enc).toString("base64"),
    ciphertext: Buffer.from(ciphertext).toString("base64"),
  };
}

async function fixtureEncryptionPublicKey() {
  const { CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } = await import(
    "@hpke/core"
  );
  const { Chacha20Poly1305 } = await import("@hpke/chacha20poly1305");
  const suite = new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });
  const keyPair = await suite.kem.generateKeyPair();
  const publicKey = await suite.kem.serializePublicKey(keyPair.publicKey);
  return Buffer.from(publicKey).toString("base64");
}

function read(key) {
  const value = process.env[key] ?? fileEnv[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readEnvFile(file) {
  if (!fs.existsSync(file)) {
    return {};
  }
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }
    values[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return values;
}

function promptPlain(label) {
  return new Promise((resolve) => {
    process.stdout.write(label);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => {
      resolve(data.trim());
    });
  });
}

function promptHidden(label) {
  if (!process.stdin.isTTY) {
    return promptPlain(label);
  }
  return new Promise((resolve, reject) => {
    process.stdout.write(label);
    const stdin = process.stdin;
    let value = "";
    const wasRaw = stdin.isRaw;
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    const onData = (char) => {
      if (char === "\u0003") {
        cleanup();
        reject(new Error("Input cancelled"));
        return;
      }
      if (char === "\r" || char === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

function apiBaseUrl() {
  return (read("PRIVY_API_BASE_URL") ?? "https://api.privy.io").replace(
    /\/+$/,
    "",
  );
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function shortPath(file) {
  return path.relative(rootDir, file) || ".";
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function cleanError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/0x[a-fA-F0-9]{64}/g, "0x<redacted-private-key>")
    .replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic <redacted>")
    .replace(/https:\/\/[^\s"]+/gi, "https://<redacted>");
}
