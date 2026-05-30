const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const rootDir = process.env.FANPASS_PROTOTYPE_RESET_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_PROTOTYPE_RESET_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

auditResetController();
auditRouteRoleMatrix();
auditPrivacyMatrix();
auditShortcutRegister();
auditPrototypeScripts();
auditCompositeVerifier();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      route: "POST /prototype/reset",
      access: ["ORGANIZER", "ADMIN"],
      classification: "LOCAL_DEBUG",
    },
    null,
    2,
  ),
);

function auditResetController() {
  const relativePath = "apps/api/src/app.controller.ts";
  const source = readTypeScript(relativePath);
  const resetMethod = findMethod(source, "resetPrototype");
  if (!resetMethod) {
    errors.push(`${relativePath} must define resetPrototype().`);
    return;
  }

  const decorators = getDecoratorTexts(resetMethod, source);
  if (!decorators.includes('Post("/prototype/reset")')) {
    errors.push("resetPrototype must remain POST /prototype/reset.");
  }
  if (decorators.some((decorator) => decorator.startsWith("PublicRoute("))) {
    errors.push("resetPrototype must not be marked @PublicRoute().");
  }
  if (!decorators.includes("UseGuards(FanPassAuthGuard)")) {
    errors.push("resetPrototype must use FanPassAuthGuard.");
  }
  const roles = decorators.find((decorator) => decorator.startsWith("Roles("));
  if (!roles) {
    errors.push("resetPrototype must declare role access.");
    return;
  }
  if (!roles.includes('"ORGANIZER"') || !roles.includes('"ADMIN"')) {
    errors.push("resetPrototype must stay limited to ORGANIZER and ADMIN.");
  }
  if (roles.includes('"FAN"') || roles.includes('"GATE_STAFF"')) {
    errors.push("resetPrototype must not allow FAN or GATE_STAFF roles.");
  }
}

function auditRouteRoleMatrix() {
  const contents = readFile("apps/api/test/route-security.spec.ts");
  if (
    !contents.includes(
      '["AppController.resetPrototype", ["ORGANIZER", "ADMIN"]]',
    )
  ) {
    errors.push(
      "route-security.spec.ts must lock resetPrototype to ORGANIZER and ADMIN.",
    );
  }
}

function auditPrivacyMatrix() {
  const contents = readFile("docs/API_RESPONSE_PRIVACY_MATRIX.md");
  if (
    !/apps\/api\/src\/app\.controller\.ts:resetPrototype[\s\S]*POST \/prototype\/reset[\s\S]*LOCAL_DEBUG/.test(
      contents,
    )
  ) {
    errors.push(
      "API_RESPONSE_PRIVACY_MATRIX.md must classify POST /prototype/reset as LOCAL_DEBUG.",
    );
  }
}

function auditShortcutRegister() {
  const contents = readFile("docs/PROTOTYPE_SHORTCUT_REGISTER.md");
  const section = extractSection(contents, "PS-009");
  if (!section) {
    errors.push(
      "PROTOTYPE_SHORTCUT_REGISTER.md must register PS-009 for the prototype reset endpoint.",
    );
    return;
  }
  const requiredMarkers = [
    "apps/api/src/app.controller.ts",
    "scripts/prototype-start.sh",
    "scripts/prototype-verify.sh",
    "docs/API_RESPONSE_PRIVACY_MATRIX.md",
  ];
  for (const marker of requiredMarkers) {
    if (!section.includes(marker)) {
      errors.push(`PS-009 evidence must mention ${marker}.`);
    }
  }
  if (!/Release Gate: .*external Beta/i.test(section)) {
    errors.push("PS-009 must keep an explicit external Beta release gate.");
  }
}

function auditPrototypeScripts() {
  for (const relativePath of [
    "scripts/prototype-start.sh",
    "scripts/prototype-verify.sh",
  ]) {
    const contents = readFile(relativePath);
    if (!contents.includes("/auth/demo-session")) {
      errors.push(`${relativePath} must obtain a local demo bearer token.`);
    }
    if (!contents.includes("usr_organizer_demo")) {
      errors.push(`${relativePath} must reset with the seeded organizer actor.`);
    }
    if (!contents.includes("/prototype/reset")) {
      errors.push(`${relativePath} must call POST /prototype/reset explicitly.`);
    }
    if (!contents.includes("Authorization") || !contents.includes("Bearer")) {
      errors.push(`${relativePath} must send an Authorization bearer header.`);
    }
  }
}

function auditCompositeVerifier() {
  const contents = readFile("scripts/beta-foundation-verify.sh");
  const selfTest = "security:prototype-reset-policy:self-test";
  const audit = "security:prototype-reset-policy";
  if (!contents.includes(selfTest) || !contents.includes(audit)) {
    errors.push(
      "beta-foundation-verify.sh must run prototype reset policy self-test and audit.",
    );
    return;
  }
  if (contents.indexOf(selfTest) > contents.indexOf(audit)) {
    errors.push(
      "beta-foundation-verify.sh must run prototype reset policy self-test before the real audit.",
    );
  }
}

function readTypeScript(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  return ts.createSourceFile(absolutePath, contents, ts.ScriptTarget.Latest, true);
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function findMethod(source, methodName) {
  for (const statement of source.statements) {
    if (!ts.isClassDeclaration(statement)) {
      continue;
    }
    for (const member of statement.members) {
      if (
        ts.isMethodDeclaration(member) &&
        member.name?.getText(source) === methodName
      ) {
        return member;
      }
    }
  }
  return undefined;
}

function getDecoratorTexts(node, source) {
  return ts
    .getDecorators(node)
    ?.map((decorator) => decorator.expression.getText(source)) ?? [];
}

function extractSection(contents, id) {
  const headings = [...contents.matchAll(/^## (PS-\d{3}) - .+$/gm)];
  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    if (match[1] !== id) {
      continue;
    }
    const next = headings[index + 1];
    return contents.slice(match.index, next?.index ?? contents.length);
  }
  return undefined;
}
