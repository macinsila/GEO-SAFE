/**
 * Smoke test: admin updates warehouse inventory via the Admin Console.
 *
 * Flow:
 *  1. Navigate to /admin (admin-only, session injected via storageState).
 *  2. Default tab "Depolar ve Stok" renders immediately.
 *  3. Click the seeded "E2E Test Depot" warehouse button.
 *  4. The inventory row for "E2E Test Su" appears.
 *  5. Update the quantity input and click "Stok Kaydet".
 *  6. Assert "Stok güncellendi" confirmation is shown.
 */

import * as path from "path";
import { test, expect } from "@playwright/test";

test.use({
  storageState: path.join(__dirname, "../.auth/admin.json"),
});

test.describe("admin manages warehouse inventory", () => {
  test("admin selects depot and saves inventory quantity", async ({ page }) => {
    await page.goto("/admin");

    // Admin header is the landmark for a loaded page
    await expect(page.getByText("GeoSafe Admin Konsolu")).toBeVisible({
      timeout: 10_000,
    });

    // Default tab is "Depolar ve Stok" — confirm it rendered
    await expect(page.getByText("Depo Bazlı Stok Güncelleme")).toBeVisible({
      timeout: 10_000,
    });

    // Click the seeded warehouse to open its inventory
    await page.getByRole("button", { name: /E2E Test Depot/i }).click();

    // Inventory section should now show the seeded item
    await expect(page.getByText("E2E Test Su")).toBeVisible({ timeout: 8_000 });

    // Locate the quantity input in the row that contains "E2E Test Su"
    const itemRow = page
      .locator("div")
      .filter({ has: page.getByText("E2E Test Su", { exact: true }) })
      .last();

    const quantityInput = itemRow.locator('input[type="number"]');
    await quantityInput.fill("42");

    // Save
    await page.getByRole("button", { name: "Stok Kaydet" }).click();

    // Confirmation message
    await expect(page.getByText("Stok güncellendi")).toBeVisible({
      timeout: 10_000,
    });
  });
});
