const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/provider-boundary-audit.js");

const cases = [
  {
    label:
      "accepts a fixture with providers isolated behind approved boundaries",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects Stripe Node SDK outside PaymentsService",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/orders/stripe-leak.ts",
        'import Stripe from "stripe";\nexport const leak = Stripe;\n',
      ),
  },
  {
    label: "rejects lifecycle service importing provider services directly",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/orders/orderbook.service.ts",
        '\nimport { OwnershipService } from "../ownership/ownership.service";\n',
      ),
  },
  {
    label: "rejects FanPassOps linking Stripe",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/project.yml",
        projectYml({ fanPassOpsStripe: true }),
      ),
  },
  {
    label: "rejects Privy Swift SDK outside shared provider",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/FanPass/Features/Auth/AuthView.swift",
        "import PrivySDK\nstruct AuthView {}\n",
      ),
  },
  {
    label: "rejects Privy React SDK before Console isolation evidence",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/src/privy-login.tsx",
        'import { usePrivy } from "@privy-io/react-auth";\nexport function PrivyLogin() { return usePrivy(); }\n',
      ),
  },
  {
    label: "rejects Privy React SDK dependency before isolation evidence",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/dashboard/package.json",
        JSON.stringify(
          {
            name: "@fanpass/dashboard",
            dependencies: {
              "@privy-io/react-auth": "3.35.0",
            },
          },
          null,
          2,
        ),
      ),
  },
  {
    label: "rejects isolated Console auth app joining root workspaces",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "package.json",
        JSON.stringify(
          {
            name: "fanpass-fixture",
            workspaces: ["apps/*", "packages/shared"],
          },
          null,
          2,
        ),
      ),
  },
  {
    label: "rejects Socket.IO browser client outside Console live panel",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "packages/shared/src/realtime-client.ts",
        'import { io } from "socket.io-client";\nexport const makeClient = io;\n',
      ),
  },
  {
    label: "rejects Stripe dependency outside API package manifest",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "packages/shared/package.json",
        JSON.stringify(
          {
            name: "@fanpass/shared",
            dependencies: {
              stripe: "22.2.0",
            },
          },
          null,
          2,
        ),
      ),
  },
  {
    label: "rejects Socket.IO client dependency outside approved manifests",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "packages/shared/package.json",
        JSON.stringify(
          {
            name: "@fanpass/shared",
            dependencies: {
              "socket.io-client": "4.8.3",
            },
          },
          null,
          2,
        ),
      ),
  },
  {
    label: "rejects provider dependency drift in package lockfile",
    expected: "fail",
    mutate: (fixtureRoot) =>
      mutateFixtureLockfile(fixtureRoot, (lockfile) => {
        lockfile.packages["apps/dashboard"].dependencies.stripe = "22.2.0";
      }),
  },
  {
    label: "rejects missing iOS Privy target dependency",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/ios/FanPass/project.yml",
        projectYml({ fanPassOpsPrivy: false }),
      ),
  },
  {
    label: "rejects payment worker dispatch without outbox idempotency key",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
        workerService({ paymentKeyMarker: "payment.idempotencyKey" }),
      ),
  },
  {
    label: "rejects AuthService owning Privy verifier details",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/auth/auth.service.ts",
        authService({ ownsPrivyVerifier: true }),
      ),
  },
  {
    label: "rejects removed production-like testnet ownership guard",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/config/security-config.ts",
        securityConfig({ includeTestnetGuard: false }),
      ),
  },
  {
    label: "rejects ownership finalization saga drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
        workerService({ ownershipFinalizeType: "OWNERSHIP_TRANSFER" }),
      ),
  },
  {
    label: "rejects stale processing lock recovery drift",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
        workerService({ includeStaleRecovery: false }),
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-provider-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_PROVIDER_AUDIT_ROOT: fixtureRoot,
      },
      encoding: "utf8",
    });
    const passed = result.status === 0;
    const expectedPass = testCase.expected === "pass";
    return {
      label: testCase.label,
      expected: testCase.expected,
      status: result.status,
      ok: passed === expectedPass,
      stderr: result.stderr.trim(),
    };
  } finally {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        failures,
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
      cases: results.map(({ label, expected, status }) => ({
        label,
        expected,
        status,
      })),
    },
    null,
    2,
  ),
);

function writePassingFixture(fixtureRoot) {
  writeFixtureFile(
    fixtureRoot,
    "package.json",
    JSON.stringify(
      {
        name: "fanpass-fixture",
        workspaces: ["apps/api", "apps/dashboard", "packages/shared"],
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/console-auth/package.json",
    JSON.stringify(
      {
        name: "@fanpass/console-auth",
        private: true,
        dependencies: {
          "@privy-io/react-auth": "3.35.0",
          next: "15.5.18",
          react: "19.1.0",
          "react-dom": "19.1.0",
        },
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/console-auth/package-lock.json",
    JSON.stringify(
      {
        name: "@fanpass/console-auth",
        version: "0.1.0",
        lockfileVersion: 3,
        packages: {
          "": {
            name: "@fanpass/console-auth",
            version: "0.1.0",
            dependencies: {
              "@privy-io/react-auth": "3.35.0",
              next: "15.5.18",
              react: "19.1.0",
              "react-dom": "19.1.0",
            },
          },
          "node_modules/@privy-io/react-auth": {
            version: "3.35.0",
          },
        },
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/console-auth/app/privy-console-login.tsx",
    'import { PrivyProvider, usePrivy } from "@privy-io/react-auth";\nexport function PrivyLogin() { return String(Boolean(PrivyProvider && usePrivy)); }\n',
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/package.json",
    JSON.stringify(
      {
        name: "@fanpass/dashboard",
        dependencies: {
          "socket.io-client": "4.8.3",
          "@vitejs/plugin-react": "5.1.1",
          vite: "7.2.6",
        },
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/package.json",
    JSON.stringify(
      {
        name: "@fanpass/api",
        dependencies: {
          stripe: "22.2.0",
        },
        devDependencies: {
          "socket.io-client": "4.8.3",
        },
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "packages/shared/package.json",
    JSON.stringify(
      {
        name: "@fanpass/shared",
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "package-lock.json",
    JSON.stringify(
      {
        name: "fanpass-fixture",
        version: "0.1.0",
        lockfileVersion: 3,
        packages: {
          "": {
            name: "fanpass-fixture",
            version: "0.1.0",
            workspaces: ["apps/api", "apps/dashboard", "packages/shared"],
          },
          "apps/api": {
            name: "@fanpass/api",
            version: "0.1.0",
            dependencies: {
              stripe: "22.2.0",
            },
            devDependencies: {
              "socket.io-client": "4.8.3",
            },
          },
          "apps/dashboard": {
            name: "@fanpass/dashboard",
            version: "0.1.0",
            dependencies: {
              "socket.io-client": "4.8.3",
              "@vitejs/plugin-react": "5.1.1",
              vite: "7.2.6",
            },
          },
          "packages/shared": {
            name: "@fanpass/shared",
            version: "0.1.0",
          },
          "node_modules/stripe": {
            version: "22.2.0",
          },
        },
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/payments/payments.service.ts",
    paymentsService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/ownership/ownership.service.ts",
    ownershipService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/auth/privy-token.service.ts",
    privyTokenService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/common/fanpass-socket-io.adapter.ts",
    'import { ServerOptions } from "socket.io";\nexport const options: Partial<ServerOptions> = {};\n',
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/orders/orderbook.gateway.ts",
    'import { Server } from "socket.io";\nexport class OrderbookGateway { server?: Server; }\n',
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/orders/orderbook-realtime.service.ts",
    'import { Server } from "socket.io";\nexport class OrderbookRealtimeService { publish(server: Server) { return server; } }\n',
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/dashboard/src/OrderbookLivePanel.tsx",
    'import { io } from "socket.io-client";\nexport function OrderbookLivePanel() { return String(Boolean(io)); }\n',
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/auth/auth.service.ts",
    authService(),
  );
  writeFixtureFile(fixtureRoot, "apps/api/src/app.module.ts", appModule());
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
    workerService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/side-effects/side-effect-outbox.service.ts",
    outboxService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/orders/orderbook.service.ts",
    orderbookService(),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/tickets/tickets.service.ts",
    "export class TicketsService {}\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/verification/verification.service.ts",
    "export class VerificationService {}\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/config/security-config.ts",
    securityConfig(),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/side-effects-worker-verify.sh",
    "echo sfx_worker_stale_recovery\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/App/FanPassApp.swift",
    "import StripeCore\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
    "import PrivySDK\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift",
    "import StripePaymentSheet\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Services/FanPassOrderbookRealtimeClient.swift",
    "import SocketIO\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Features/Scanner/NFCPayloadScanner.swift",
    "import CoreNFC\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift",
    "import AVFoundation\n",
  );
  writeFixtureFile(fixtureRoot, "apps/ios/FanPass/project.yml", projectYml());
}

function paymentsService() {
  return `
import Stripe from "stripe";

export class PaymentsService {
  captureProviderPaymentIntent(payment, sideEffectIdempotencyKey) {
    return this.stripe.paymentIntents.capture(payment.providerPaymentIntentId, {
      idempotencyKey: sideEffectIdempotencyKey ?? this.paymentCaptureSideEffectKey(payment.id),
    });
  }

  cancelProviderPaymentIntent(payment, sideEffectIdempotencyKey) {
    return this.stripe.paymentIntents.cancel(payment.providerPaymentIntentId, {
      idempotencyKey: sideEffectIdempotencyKey ?? this.paymentCancelSideEffectKey(payment.id),
    });
  }

  refundProviderPaymentIntent(payment, sideEffectIdempotencyKey) {
    return this.stripe.refunds.create({
      idempotencyKey: sideEffectIdempotencyKey ?? this.paymentRefundSideEffectKey(payment.id),
    });
  }
}
`;
}

function ownershipService() {
  return `
export class OwnershipService {
  async load() {
    await import("ethers");
  }

  validateRuntime() {
    return isProductionLikeEnvironment && this.config.get<string>("OWNERSHIP_ADAPTER") !== "testnet" && "OWNERSHIP_ADAPTER=testnet is blocked in production-like environments";
  }
}
`;
}

function privyTokenService() {
  return `
import { verify as verifySignature } from "@noble/curves/p256";

export class PrivyTokenService {
  verifyAccessToken(payload) {
    return header.alg !== "ES256" || payload.iss !== "privy.io" || this.audienceMatches(payload.aud, this.privyAppId()) || payload.exp || payload.nbf || "PRIVY_VERIFICATION_KEY" || 'dsaEncoding: "ieee-p1363"';
  }
}
`;
}

function authService(options = {}) {
  const verifierLeak = options.ownsPrivyVerifier
    ? "const verifier = process.env.PRIVY_VERIFICATION_KEY; verifySignature(token, verifier);"
    : "";
  return `
import { PrivyTokenService } from "./privy-token.service";

export class AuthService {
  constructor(private readonly privyTokens: PrivyTokenService) {}

  verify(token) {
    ${verifierLeak}
    this.privyTokens.verifyAccessToken(token);
    this.privyTokens.readJwtAlgorithm(token);
  }
}
`;
}

function appModule() {
  return "export const providers = [PrivyTokenService];\n";
}

function workerService(options = {}) {
  const paymentKeyMarker = options.paymentKeyMarker ?? "job.idempotencyKey";
  const ownershipFinalizeType =
    options.ownershipFinalizeType ?? "OWNERSHIP_SETTLEMENT_FINALIZE";
  const staleRecovery =
    options.includeStaleRecovery === false
      ? ""
      : `
    this.outbox.recoverStaleProcessingJobs();
    return { recovered: recovered.count };`;
  return `
export class SideEffectWorkerService {
  async work(job) {
    ${staleRecovery}
  }

  processCaptureJob(job) {
    return this.payments.captureProviderPaymentIntent(payment, ${paymentKeyMarker});
  }

  processCancelAuthorizationJob(job) {
    return this.payments.cancelProviderPaymentIntent(payment, ${paymentKeyMarker});
  }

  processRefundJob(job) {
    return this.payments.refundProviderPaymentIntent(payment, ${paymentKeyMarker});
  }

  dispatch(job) {
    switch (job.type) {
      case "OWNERSHIP_ISSUE":
        return this.ownership.issueTicket(job);
      case "${ownershipFinalizeType}":
        return this.orderbook.finalizeOwnershipTransfer(job);
      case "OWNERSHIP_REDEEM":
        return this.ownership.redeemTicket(job);
    }
    this.outbox.enqueueStandalone({ type: "${ownershipFinalizeType}", idempotencyKey: "ownership-finalize:" });
  }
}
`;
}

function outboxService() {
  return `
export class SideEffectOutboxService {
  enqueueStandalone(input: EnqueueSideEffectInput) {}
  recoverStaleProcessingJobs() {
    return [{ status: "PROCESSING" }, { status: "RETRYING" }, "FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS", "Recovered stale PROCESSING lock"];
  }
}
`;
}

function orderbookService() {
  return `
export class OrderbookService {
  async finalizeOwnershipTransfer() {
    return "Ownership settlement finalization requires Prisma persistence";
  }

  usesAsyncOwnershipSettlement() {
    return "FANPASS_ASYNC_OWNERSHIP_SETTLEMENT";
  }
}
`;
}

function securityConfig(options = {}) {
  const testnetGuard =
    options.includeTestnetGuard === false
      ? ""
      : `
  validateOwnershipConfiguration(config, errors);
  stringValue(config.OWNERSHIP_ADAPTER) !== "testnet";
  errors.push("OWNERSHIP_ADAPTER=testnet is blocked in production-like environments");`;
  return `
export function validate(config, errors) {
  ${testnetGuard}
  return "FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS";
}
`;
}

function projectYml(options = {}) {
  const fanPassOpsStripe = options.fanPassOpsStripe
    ? "      dependencies:\n        - package: Stripe\n          product: StripePaymentSheet\n"
    : "";
  const fanPassOpsPrivy =
    options.fanPassOpsPrivy === false
      ? ""
      : "      - package: Privy\n        product: Privy\n";
  return `
targets:
  FanPass:
    sources:
      - path: FanPass
        excludes:
          - Features/Scanner
          - FanPassOrderbookRealtimeClient.swift
    dependencies:
      - package: Stripe
        product: StripePaymentSheet
      - package: SocketIO
        product: SocketIO
      - package: Privy
        product: Privy
  FanPassOps:
    sources:
      - path: FanPass
        excludes:
          - FanPassOrderbookRealtimeClient.swift
    dependencies:
${fanPassOpsPrivy}
${fanPassOpsStripe}`;
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function mutateFixtureLockfile(fixtureRoot, mutate) {
  const lockfilePath = path.join(fixtureRoot, "package-lock.json");
  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
  mutate(lockfile);
  fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
}

function appendFixtureFile(fixtureRoot, relativePath, contents) {
  fs.appendFileSync(path.join(fixtureRoot, relativePath), contents);
}
