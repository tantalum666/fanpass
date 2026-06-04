const { chromium } = require("@playwright/test");

const consoleUrl = process.env.FANPASS_CONSOLE_URL ?? "http://localhost:3000";
const screenshotPath =
  process.env.FANPASS_CONSOLE_SCREENSHOT ??
  "outputs/playwright/fanpass-console-beta-gate-staff-full.png";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  try {
    await page.goto(consoleUrl, { waitUntil: "networkidle", timeout: 30000 });
    const qaSuffix = Date.now().toString(36);
    await page.locator('input[name="gate"]').fill(`QA-${qaSuffix.slice(-4)}`);
    await page
      .locator('input[name="staffName"]')
      .fill("QA Gate Staff Invite");
    await page
      .locator('input[name="staffEmail"]')
      .fill(`qa-gate-${qaSuffix}@fanpass.test`);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/console/gate-assignments") &&
          response.request().method() === "POST",
        { timeout: 15000 },
      ),
      page.getByRole("button", { name: "Assign staff" }).click(),
    ]);
    await page
      .getByTestId("staff-invite-token")
      .waitFor({ state: "visible", timeout: 15000 });
    const staffRow = page
      .getByRole("row")
      .filter({ hasText: "QA Gate Staff Invite" })
      .first();
    await staffRow.waitFor({ state: "visible", timeout: 15000 });
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/console/gate-assignments/") &&
          response.url().includes("/invites") &&
          response.request().method() === "POST",
        { timeout: 15000 },
      ),
      staffRow.getByRole("button", { name: "Rotate invite" }).click(),
    ]);
    await page
      .getByTestId("rotated-staff-invite-token")
      .waitFor({ state: "visible", timeout: 15000 });
    const bodyText = await page.locator("body").innerText();

    await page
      .getByTestId("rotated-staff-invite-token")
      .getByRole("button", { name: "Clear" })
      .click();
    await page
      .getByTestId("staff-invite-token")
      .getByRole("button", { name: "Clear" })
      .click();
    await page
      .getByTestId("staff-invite-token")
      .waitFor({ state: "hidden", timeout: 15000 });
    await page
      .getByTestId("rotated-staff-invite-token")
      .waitFor({ state: "hidden", timeout: 15000 });

    await page.locator('input[name="staffEmail"]').fill("redacted");

    await page.screenshot({ path: screenshotPath, fullPage: true });

    const result = {
      ok:
        bodyText.includes("Gate Staff Assignments") &&
        bodyText.includes("Assign Gate Staff") &&
        bodyText.includes("ONE-TIME INVITE") &&
        bodyText.includes("ROTATED INVITE") &&
        !/Runtime Error|Cannot find module|Unhandled Runtime Error/i.test(
          bodyText,
        ) &&
        consoleErrors.length === 0,
      consoleUrl,
      hasGateStaffAssignments: bodyText.includes("Gate Staff Assignments"),
      hasAssignGateStaff: bodyText.includes("Assign Gate Staff"),
      hasOneTimeInviteToken: bodyText.includes("ONE-TIME INVITE"),
      hasRotatedInviteToken: bodyText.includes("ROTATED INVITE"),
      hasRuntimeError:
        /Runtime Error|Cannot find module|Unhandled Runtime Error/i.test(
          bodyText,
        ),
      consoleErrors,
      screenshot: screenshotPath,
    };

    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
