import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const enabled = process.env.E2E_LIVE === "1";
async function login(page: Page, role: "LEAD" | "STAFF") {
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  const tenantId = process.env.E2E_TENANT_ID;
  if (!email || !password || !tenantId || !process.env.E2E_BASE_URL) throw new Error(`Live-Tests benötigen E2E_BASE_URL, E2E_TENANT_ID und E2E_${role}_EMAIL/PASSWORD.`);
  await page.goto("/auth");
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth(?:\?|$)/);
  // Dieselbe gespeicherte Büroauswahl, die der TenantProvider regulär liest.
  const found = await page.evaluate(({ tenantId }) => {
    const authKey = Object.keys(localStorage).find(key => /^sb-.*-auth-token$/.test(key));
    const userId = authKey ? JSON.parse(localStorage.getItem(authKey) ?? "null")?.user?.id : null;
    if (userId) localStorage.setItem(`currentTenantId_${userId}`, tenantId);
    return !!userId;
  }, { tenantId });
  expect(found, "Die reguläre Anmeldung muss eine Session bereitstellen.").toBe(true);
  await page.goto("/selftest");
  await expect(page.getByTestId("selftest-center")).toHaveAttribute("data-tenant-id", tenantId);
  page.on("dialog", dialog => dialog.accept());
}

test.describe("Selbsttests im Browser gegen das tatsächliche Backend", () => {
  test.skip(!enabled, "Live-Testbüro und Konten nicht aktiviert (E2E_LIVE=1 erforderlich).");

  for (const id of ["case-item-lifecycle", "letter-lifecycle", "appointment-request-lifecycle"]) {
    test(`${id}: vollständiger Fachablauf und Aufräumen`, async ({ page }) => {
      await login(page, "LEAD");
      const card = page.getByTestId(`scenario-${id}`);
      await card.getByRole("button", { name: "Ausführen", exact: true }).click();
      await expect(card.getByTestId("scenario-result")).toHaveText("Bestanden", { timeout: 150_000 });
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Bericht exportieren" }).click();
      const file = await download;
      const path = await file.path();
      expect(path).toBeTruthy();
      const exported = JSON.parse(await readFile(path!, "utf8"));
      const run = exported.runs.find((r: { scenarioId: string }) => r.scenarioId === id);
      expect(run.status).toBe("ok"); expect(run.cleanup.status).toBe("ok");
      expect(run.cleanup.remaining).toEqual([]); expect(run.cleanup.storageRemaining).toEqual([]);
      await page.reload();
      await expect(page.getByTestId(`scenario-${id}`).getByTestId("scenario-result")).toHaveText("Bestanden");
    });
  }
  for (const role of ["LEAD", "STAFF"] as const) {
    test(`Zugriffsschutz als ${role}`, async ({ page }) => {
      await login(page, role);
      const card = page.getByTestId("scenario-access-boundaries");
      await card.getByRole("button", { name: "Ausführen", exact: true }).click();
      await expect(card.getByTestId("scenario-result")).toHaveText("Bestanden", { timeout: 120_000 });
      if (role === "STAFF") {
        const approval = page.getByTestId("scenario-appointment-request-lifecycle");
        await approval.getByRole("button", { name: "Ausführen", exact: true }).click();
        await expect(approval.getByTestId("scenario-result")).toHaveText("Voraussetzung fehlt");
      }
    });
  }
});
