import { test, expect } from "@playwright/test";
import { createLocalBridge, newBridgeToken } from "../../../server/localBridge";
import { protectPreview } from "./protectedPreview";

test.beforeEach(async ({ context }) => protectPreview(context));

test("a guest applies real Codex CLI assembly and BONK behavior through the Local Bridge", async ({ page }) => {
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
    await page.getByRole("button", { name: /^Continue with/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/table");
  await expect(page.locator("[data-project-id]")).toBeVisible();
  await page.getByText("Parts & wires", {exact:true}).click();
    await page.goto("/projects/new");
    await page.getByLabel("Describe your idea").fill("Make a motion alarm");
    await page.getByRole("button", { name: "Create project" }).click();
    const projectId = await page.locator("[data-project-id]").getAttribute("data-project-id");
    await page.getByRole("button",{name:"✦ Ask Kinetable"}).click();
    await page.getByRole("link", { name: "Set up AI providers →" }).click();
    await page.getByText("Advanced · routing order & Local Bridge",{exact:true}).click();
    await page.getByLabel("Bridge token").fill(token);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Connected" })).toBeVisible();
    await page.getByLabel("Add provider").selectOption("codex");
    await page.getByRole("button", { name: "Add route" }).click();
    await page.getByRole("link", { name: "Projects",exact:true }).click();
    await page.getByRole("link",{name:/Motion Alarm circuit preview/}).click();
    await page.getByRole("button", { name: "✦ Ask Kinetable" }).click();
    await page.getByRole("button", { name: "Preview assembly" }).click();
    await expect(page.getByRole("heading", { name: "I’ll add" })).toBeVisible({ timeout: 150000 });
    await page.getByRole("button",{name:"Apply",exact:true}).click();
    await expect(page.getByText("Connections complete")).toBeVisible();
    await page.getByRole("link",{name:"← Projects"}).click();await page.getByRole("link",{name:"Home",exact:true}).click();await page.getByRole("button",{name:/Try BONK/}).click();await expect(page.locator("[data-project-id]")).toBeVisible();
    await page.getByRole("button",{name:"Logic",exact:true}).click();await page.getByRole("tab",{name:"AI chat"}).click();await page.getByLabel("Message Kinetable").fill("Change the button press buzzer from two beeps to three. Preserve all other behavior.");await page.getByRole("button",{name:"Send message"}).click();await expect(page.locator(".ai-change-preview")).toContainText("3 times",{timeout:150000});await page.getByRole("button",{name:"Apply",exact:true}).click();await page.getByRole("tab",{name:"Manual"}).click();await expect(page.getByLabel("Action 3 beep count")).toHaveValue("3");await page.reload();await page.getByRole("button",{name:"Logic",exact:true}).click();await expect(page.getByLabel("Action 3 beep count")).toHaveValue("3");
    await page.goto(`/projects/${projectId}`);
    await page.reload();
    await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", projectId!);
    await expect(page.getByText("Connections complete")).toBeVisible();
  } finally {
    bridge.closeAllConnections();
    await new Promise<void>((resolve, reject) => bridge.close(error => error ? reject(error) : resolve()));
  }
});
