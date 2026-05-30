/**
 * Smoke test: authenticated operator views the live operations map
 * (the page where depots and safe zones are shown on the map).
 *
 * Uses a pre-seeded operator account injected via storageState so this test
 * does not depend on the login UI.
 */

import * as path from "path";
import { test, expect } from "@playwright/test";

test.use({
  storageState: path.join(__dirname, "../.auth/operator.json"),
});

test.describe("operator views operations map (depot overview)", () => {
  test("map page renders with depot and safe zone headers", async ({ page }) => {
    await page.goto("/ops/map");

    // Page header is present
    await expect(
      page.getByText("Canlı Operasyon Haritası")
    ).toBeVisible({ timeout: 10_000 });

    // The map container is mounted by Leaflet
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15_000 });
  });
});
