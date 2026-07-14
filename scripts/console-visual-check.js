const { chromium } = require("@playwright/test");

const consoleUrl = process.env.FANPASS_CONSOLE_URL ?? "http://localhost:3000";
const screenshotPath =
  process.env.FANPASS_CONSOLE_SCREENSHOT ??
  "outputs/playwright/fanpass-console-event-workspace.png";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    await page.goto(consoleUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.getByRole("heading", { name: "Overview" }).waitFor();

    await page.getByRole("button", { name: /Events Inventory setup/ }).click();
    await page.getByRole("searchbox", { name: "Search events" }).fill("Neon");
    await page.getByRole("button", { name: /Neon Harbor Festival/ }).click();
    await page.getByRole("heading", { name: "Neon Harbor Festival" }).waitFor();

    await page.getByRole("button", { name: /Sales & market/ }).click();
    await page.getByLabel("Ticket type").selectOption({ label: "VIP" });
    await page.getByRole("heading", { name: "Live orderbook" }).waitFor();

    await page.getByRole("button", { name: /Team Staff access/ }).click();
    await page
      .getByRole("button", { name: "Assign gate staff" })
      .first()
      .click();
    const assignmentDialog = page.getByRole("dialog", {
      name: "Assign gate staff",
    });
    const suffix = Date.now().toString(36).slice(-5);
    await assignmentDialog
      .getByRole("textbox", { name: "Gate", exact: true })
      .fill(`QA-${suffix}`);
    await assignmentDialog
      .getByRole("textbox", { name: "Staff name", exact: true })
      .fill("QA Gate Staff");
    await assignmentDialog
      .getByRole("textbox", { name: "Staff email", exact: true })
      .fill(`qa-gate-${suffix}@fanpass.test`);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/console/gate-assignments") &&
          response.request().method() === "POST",
        { timeout: 15000 },
      ),
      assignmentDialog.getByRole("button", { name: "Assign staff" }).click(),
    ]);

    const inviteNotice = page.getByTestId("staff-invite-token");
    await inviteNotice.waitFor({ state: "visible", timeout: 15000 });
    const firstInviteToken = await inviteNotice.locator("code").innerText();
    const staffRow = page
      .getByRole("row")
      .filter({ hasText: "QA Gate Staff" })
      .first();
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/console/gate-assignments/") &&
          response.url().endsWith("/invites") &&
          response.request().method() === "POST",
        { timeout: 15000 },
      ),
      staffRow.getByRole("button", { name: "Rotate invite" }).click(),
    ]);
    const rotatedInviteToken = await inviteNotice.locator("code").innerText();
    await inviteNotice.getByRole("button", { name: "Clear" }).click();
    await inviteNotice.waitFor({ state: "hidden", timeout: 15000 });

    await page.screenshot({ path: screenshotPath, fullPage: true });
    const bodyText = await page.locator("body").innerText();
    const result = {
      ok:
        bodyText.includes("Gate staff assignments") &&
        bodyText.includes("Neon Harbor Festival") &&
        firstInviteToken.length > 0 &&
        rotatedInviteToken.length > 0 &&
        firstInviteToken !== rotatedInviteToken &&
        !bodyText.includes(firstInviteToken) &&
        !bodyText.includes(rotatedInviteToken) &&
        consoleErrors.length === 0,
      consoleUrl,
      eventSearchAndSelection: bodyText.includes("Neon Harbor Festival"),
      gateStaffAssignmentVisible: bodyText.includes("Gate staff assignments"),
      inviteRotated: firstInviteToken !== rotatedInviteToken,
      inviteTokensCleared:
        !bodyText.includes(firstInviteToken) &&
        !bodyText.includes(rotatedInviteToken),
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
