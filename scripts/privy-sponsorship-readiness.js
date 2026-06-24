const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const envFile = process.env.FANPASS_PRIVY_READINESS_ENV_FILE
  ? path.resolve(process.env.FANPASS_PRIVY_READINESS_ENV_FILE)
  : path.join(rootDir, "apps/api/.env");

const fileEnv = readEnvFile(envFile);
const env = new Proxy(process.env, {
  get(target, property) {
    if (typeof property !== "string") {
      return target[property];
    }
    return target[property] ?? fileEnv[property];
  },
});

const errors = [];
const warnings = [];

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  checkRequiredRuntimeConfig();
  const dbReady = await checkDatabaseColumn();
  const ownerCheck = await checkContractOwner();

  if (errors.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          envFile: shortPath(envFile),
          dbReady,
          ownerCheck,
          warnings,
          errors,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        envFile: shortPath(envFile),
        dbReady,
        ownerCheck,
        warnings,
      },
      null,
      2,
    ),
  );
}

function checkRequiredRuntimeConfig() {
  requireExact("OWNERSHIP_ADAPTER", "privy");
  requirePresent("DATABASE_URL");
  requirePresent("PRIVY_APP_ID");
  requirePresent("PRIVY_APP_SECRET");
  requirePresent("PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY");
  requirePresent("FANPASS_PRIVY_SPONSOR_WALLET_ID");
  requireAddress("FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS");
  requireAddress("FANPASS_TICKET_CONTRACT_ADDRESS");
  requireHttpsUrl("TESTNET_RPC_URL");
  const caip2 = read("FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2") ?? "eip155:11155111";
  if (!/^eip155:\d+$/.test(caip2)) {
    errors.push("FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2 must be eip155:<chainId>");
  }
  if (read("FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES") === "true") {
    errors.push(
      "FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES must be false for Privy sponsorship readiness",
    );
  }
  if (read("TESTNET_OPERATOR_PRIVATE_KEY")) {
    warnings.push(
      "TESTNET_OPERATOR_PRIVATE_KEY is present but not used by OWNERSHIP_ADAPTER=privy",
    );
  }
}

async function checkDatabaseColumn() {
  if (process.env.FANPASS_PRIVY_READINESS_SKIP_DB === "true") {
    return { checked: false, reason: "skipped" };
  }
  if (!read("DATABASE_URL")) {
    return { checked: false, reason: "missing DATABASE_URL" };
  }
  process.env.DATABASE_URL = read("DATABASE_URL");
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const rows = await prisma.$queryRawUnsafe(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'privy_wallet_id' LIMIT 1",
      );
      const present = Array.isArray(rows) && rows.length > 0;
      if (!present) {
        errors.push(
          "Database is missing users.privy_wallet_id; run npm run prisma:push -w apps/api against the target database",
        );
      }
      return { checked: true, privyWalletIdColumn: present };
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    errors.push(`Database readiness check failed: ${cleanError(error)}`);
    return { checked: true, privyWalletIdColumn: false };
  }
}

async function checkContractOwner() {
  const rpcUrl = read("TESTNET_RPC_URL");
  const contract = read("FANPASS_TICKET_CONTRACT_ADDRESS");
  const sponsor = read("FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS");
  if (!rpcUrl || !contract || !sponsor) {
    return { checked: false, reason: "missing chain config" };
  }
  try {
    const result = await rpcCall(rpcUrl, "eth_call", [
      {
        to: contract,
        data: "0x8da5cb5b",
      },
      "latest",
    ]);
    const owner =
      typeof result === "string" && /^0x[a-fA-F0-9]{64}$/.test(result)
        ? `0x${result.slice(-40)}`
        : null;
    if (!owner) {
      errors.push("Unable to read FanPassTicket owner() from chain");
      return { checked: true, ownerMatchesSponsor: false };
    }
    const ownerMatchesSponsor = owner.toLowerCase() === sponsor.toLowerCase();
    if (!ownerMatchesSponsor) {
      errors.push(
        "FanPassTicket owner() does not match FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS",
      );
    }
    return {
      checked: true,
      owner: shortAddress(owner),
      sponsor: shortAddress(sponsor),
      ownerMatchesSponsor,
    };
  } catch (error) {
    errors.push(`Contract owner readiness check failed: ${cleanError(error)}`);
    return { checked: true, ownerMatchesSponsor: false };
  }
}

async function rpcCall(rpcUrl, method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }
  const body = await response.json();
  if (body.error) {
    throw new Error(body.error.message || "RPC returned an error");
  }
  return body.result;
}

function requirePresent(key) {
  if (!read(key)) {
    errors.push(`${key} is required`);
  }
}

function requireExact(key, expected) {
  const value = read(key);
  if (value !== expected) {
    errors.push(`${key} must be ${expected}`);
  }
}

function requireAddress(key) {
  const value = read(key);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value ?? "")) {
    errors.push(`${key} must be an EVM address`);
  }
}

function requireHttpsUrl(key) {
  const value = read(key);
  if (!value || !value.startsWith("https://")) {
    errors.push(`${key} must be an HTTPS URL`);
  }
}

function read(key) {
  const value = env[key];
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

function shortPath(file) {
  return path.relative(rootDir, file) || ".";
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function cleanError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://<redacted>")
    .replace(/https:\/\/[^\s"]+/gi, "https://<redacted>");
}
