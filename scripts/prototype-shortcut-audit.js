const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_PROTOTYPE_SHORTCUT_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_PROTOTYPE_SHORTCUT_AUDIT_ROOT)
  : path.resolve(__dirname, "..");
const registerPath = path.join(rootDir, "docs/PROTOTYPE_SHORTCUT_REGISTER.md");
const register = fs.readFileSync(registerPath, "utf8");

const requiredShortcutIds = [
  "PS-001",
  "PS-002",
  "PS-003",
  "PS-004",
  "PS-005",
  "PS-006",
  "PS-007",
  "PS-008",
  "PS-009",
];

const requiredFields = [
  "Status",
  "Scope",
  "Owner",
  "Risk",
  "Replacement Path",
  "Release Gate",
  "Evidence",
];

const evidenceMarkers = [
  {
    id: "PS-001",
    markers: [
      "apps/api/src/config/security-config.ts",
      "scripts/security-runtime-staging-check.sh",
    ],
  },
  {
    id: "PS-002",
    markers: [
      "QR_SIGNING_SECRET",
      "apps/api/src/modules/verification/verification.service.ts",
    ],
  },
  {
    id: "PS-003",
    markers: ["scripts/beta-local-start.sh", "scripts/alpha-prisma-verify.sh"],
  },
  {
    id: "PS-004",
    markers: [
      "apps/api/src/modules/ownership/ownership.service.ts",
      "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
    ],
  },
  {
    id: "PS-005",
    markers: [
      "apps/ios/FanPass/FanPass/Features/Scanner",
      "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
    ],
  },
  {
    id: "PS-006",
    markers: ["docs/IOS_DISTRIBUTION_PLAN.md", ".pkpass"],
  },
  {
    id: "PS-007",
    markers: [
      "apps/api/src/modules/alpha/alpha-persistence.service.ts",
      "apps/dashboard/src/ConsoleApp.tsx",
    ],
  },
  {
    id: "PS-008",
    markers: [
      "apps/ios/FanPass/Config",
      "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
    ],
  },
  {
    id: "PS-009",
    markers: [
      "apps/api/src/app.controller.ts",
      "scripts/prototype-start.sh",
      "scripts/prototype-verify.sh",
      "docs/API_RESPONSE_PRIVACY_MATRIX.md",
    ],
  },
];

const errors = [];
const sections = parseShortcutSections(register);

for (const id of requiredShortcutIds) {
  const section = sections.get(id);
  if (!section) {
    errors.push(`Missing ${id} in docs/PROTOTYPE_SHORTCUT_REGISTER.md`);
    continue;
  }
  for (const field of requiredFields) {
    if (!new RegExp(`^- ${escapeRegExp(field)}: .+`, "m").test(section)) {
      errors.push(`${id} is missing required field: ${field}`);
    }
  }
  const evidence = evidenceMarkers.find((marker) => marker.id === id);
  for (const marker of evidence?.markers ?? []) {
    if (!section.includes(marker)) {
      errors.push(`${id} evidence must mention ${marker}`);
    }
  }
}

for (const id of sections.keys()) {
  if (!requiredShortcutIds.includes(id)) {
    errors.push(
      `Unexpected shortcut id ${id}; add it to prototype-shortcut-audit.js`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      shortcuts: requiredShortcutIds.length,
      requiredFields,
    },
    null,
    2,
  ),
);

function parseShortcutSections(contents) {
  const headings = [...contents.matchAll(/^## (PS-\d{3}) - .+$/gm)];
  const parsed = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    const next = headings[index + 1];
    parsed.set(
      match[1],
      contents.slice(match.index, next?.index ?? contents.length),
    );
  }
  return parsed;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
