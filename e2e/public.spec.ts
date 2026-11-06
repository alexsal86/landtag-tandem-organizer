import { expect, test } from "@playwright/test";

test("Selbsttest-Center erfordert eine Anmeldung", async ({ page }) => {
  await page.goto("/selftest");
  await expect(page).toHaveURL(/\/auth(?:\?|$)/);
  await expect(page.locator("#signin-email")).toBeVisible();
  await expect(page.locator("#signin-password")).toBeVisible();
  await expect(page.getByTestId("selftest-center")).toHaveCount(0);
});
