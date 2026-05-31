/**
 * Smoke test: citizen files an emergency report (public form, no auth required).
 * Geolocation is granted via browser context to bypass the native permission prompt.
 */

import { test, expect } from "@playwright/test";

test.describe("citizen files emergency report", () => {
  test("submits form and sees success confirmation", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 41.01, longitude: 29.02 });

    await page.goto("/emergency");

    await expect(page.locator("h1")).toContainText("Acil Durum");

    // Category is pre-selected; pick a specific value to be deterministic
    await page.selectOption("#emergency-category", "Yaraliyim");

    await page.fill(
      "#emergency-description",
      "E2E testi — lütfen görmezden gelin"
    );

    await page.click('button[type="submit"]');

    // The success banner should appear after the backend confirms receipt
    await expect(
      page.locator(".form-status.success strong")
    ).toContainText("Bildirim kaydedildi", { timeout: 15_000 });
  });
});
