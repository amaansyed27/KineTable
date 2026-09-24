import { test, expect } from "@playwright/test";
import { createLocalBridge, newBridgeToken } from "../../../server/localBridge";
import { protectPreview } from "./protectedPreview";

test.beforeEach(async ({ context }) => protectPreview(context));

test("a guest assembles and reloads a real Codex CLI plan through the Local Bridge", async ({ page }) => {
  test.skip(process.env.KINETABLE_REAL_CLI_BROWSER_QA !== "1", "Requires an authenticated Codex CLI");
  test.setTimeout(180000);
  const origin = new URL(process.env.E2E_BASE_URL || "http://127.0.0.1:4174").origin;
  const token = newBridgeToken();
  const bridge = createLocalBridge({ token, origins: [origin] });
  await new Promise<void>(resolve => bridge.listen(46837, "127.0.0.1", resolve));
  try {
    if (origin.startsWith("https:")) await page.context().grantPermissions(["local-network-access"], { origin });
    await page.goto("/start");
    await page.getByRole("radio", { name: "ESP32", exact: true }).check();
    await page.getByRole("button", { name: "Set up my table" }).click();
    await page.getByRole("link", { name: "New Build" }).click();
    await page.getByLabel("Describe your idea").fill("Make a motion alarm");
    await page.getByRole("button", { name: "Create build" }).click();
    const projectId = await page.locator("[data-project-id]").getAttribute("data-project-id");
    await page.getByRole("link", { name: "Provider settings" }).click();
    await page.getByLabel("Bridge token").fill(token);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Connected" })).toBeVisible();
    await page.getByLabel("Add provider").selectOption("codex");
    await page.getByRole("button", { name: "Add route" }).click();
    await page.getByLabel("Model ID").fill("gpt-6-luna");
    await page.getByRole("link", { name: "Back to your table" }).click();
    await page.getByRole("button", { name: "Build with Kinetable" }).click();
    await expect(page.getByRole("heading", { name: "Your build is on the table." })).toBeVisible({ timeout: 150000 });
    await expect(page.getByText("6 validated connections.", { exact: false })).toBeVisible();
    await expect(page.getByText("HC-SR501 PIR · Grove Buzzer V1.1")).toBeVisible();
    await page.reload();
    await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", projectId!);
    await expect(page.getByRole("heading", { name: "Your build is on the table." })).toBeVisible();
  } finally {
    bridge.closeAllConnections();
    await new Promise<void>((resolve, reject) => bridge.close(error => error ? reject(error) : resolve()));
  }
});
