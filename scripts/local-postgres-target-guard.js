#!/usr/bin/env node
const allowedProtocols = new Set(["postgres:", "postgresql:"]);
const allowedHosts = new Set(["127.0.0.1", "[::1]"]);

function isAllowedLocalPostgresTarget(connectionString, databaseName) {
  let target;
  try {
    target = new URL(connectionString);
  } catch {
    return false;
  }

  const authorityMatch = connectionString.match(
    /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i,
  );
  const authority = authorityMatch?.[1] ?? "";
  const hostAndPort = authority.slice(authority.lastIndexOf("@") + 1);
  let explicitHost = hostAndPort;
  let explicitPort = "";
  if (hostAndPort.startsWith("[")) {
    const closingBracket = hostAndPort.indexOf("]");
    if (closingBracket === -1) {
      return false;
    }
    explicitHost = hostAndPort.slice(0, closingBracket + 1);
    explicitPort = hostAndPort.slice(closingBracket + 1);
  } else {
    const colon = hostAndPort.lastIndexOf(":");
    if (colon >= 0) {
      explicitHost = hostAndPort.slice(0, colon);
      explicitPort = hostAndPort.slice(colon);
    }
  }

  let decodedDatabase;
  try {
    decodedDatabase = decodeURIComponent(target.pathname.slice(1));
  } catch {
    return false;
  }

  return (
    allowedProtocols.has(target.protocol) &&
    target.username.length > 0 &&
    target.password.length > 0 &&
    allowedHosts.has(explicitHost.toLowerCase()) &&
    allowedHosts.has(target.hostname.toLowerCase()) &&
    (!explicitPort || /^:[0-9]+$/.test(explicitPort)) &&
    decodedDatabase === databaseName &&
    !target.hash &&
    target.search.length === 0
  );
}

function main() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const expectedDatabase =
    process.env.FANPASS_LOCAL_DATABASE_EXPECTED_NAME ?? "fanpass";
  if (!isAllowedLocalPostgresTarget(databaseUrl, expectedDatabase)) {
    console.error(
      "Local PostgreSQL target refused: use explicit credentials and the expected database on 127.0.0.1 or ::1 without connection overrides.",
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  isAllowedLocalPostgresTarget,
};
