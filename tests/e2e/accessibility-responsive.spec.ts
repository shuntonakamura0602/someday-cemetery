import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({}, testInfo) => {
  testInfo.setTimeout(60_000);
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))).toEqual({ documentWidth: 360, viewportWidth: 360 });
}

test("UX07: list and keyboard map navigation reach the same public grave", async ({ page }) => {
  await page.goto("/");
  const mapGrave = page.getByRole("gridcell", { name: /Plot 3: My Weekend App, example/i });
  await mapGrave.focus();
  await expect(mapGrave).toBeFocused();
  await Promise.all([
    page.waitForURL(/\/g\/[0-9a-f-]{36}$/i),
    mapGrave.press("Enter"),
  ]);
  await expect(page.getByRole("heading", { name: "My Weekend App" })).toBeVisible({ timeout: 15_000 });

  await page.goto("/");
  await page.getByRole("button", { name: "List view" }).click();
  const listGrave = page.locator("#cemetery").getByRole("link", { name: /My Weekend App/i });
  const listHref = await listGrave.getAttribute("href");
  expect(listHref).not.toBeNull();
  await Promise.all([
    page.waitForURL(new RegExp(`${listHref}$`)),
    listGrave.click(),
  ]);
  await expect(page.getByRole("heading", { name: "My Weekend App" })).toBeVisible({ timeout: 15_000 });

  await page.goto("/create");
  const first = page.getByRole("gridcell", { name: /Plot 1: open resting place/i });
  const second = page.getByRole("gridcell", { name: /Plot 2: open resting place/i });
  await first.focus();
  await first.press("ArrowRight");
  await expect(second).toBeFocused();
});

test("UX03 and UX06: 48 graphemes, emoji, and a long word fit at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/create");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("gridcell", { name: /Plot 1: open resting place/i }).click();
  const title = "🚀".repeat(48);
  const epitaph = "A".repeat(148) + " 🌙";
  await page.getByLabel("Project name").fill(title);
  await expect(page.getByText("48/48", { exact: true })).toBeVisible();
  await page.getByLabel("A few parting words, optional").fill(epitaph);
  await page.getByRole("button", { name: "Lay it to rest" }).click();
  await expect(page.getByRole("heading", { name: "Your project has a place here." })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const publicHref = await page.getByRole("link", { name: "Visit the grave" }).getAttribute("href");
  expect(publicHref).not.toBeNull();
  await Promise.all([
    page.waitForURL(new RegExp(`${publicHref}$`)),
    page.getByRole("link", { name: "Visit the grave" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("blockquote")).toHaveText(epitaph);
  await expect(page.getByRole("button", { name: "Leave a flower" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy public link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download image" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await Promise.all([
    page.waitForURL(/\/g\/[0-9a-f-]{36}\/customize$/i),
    page.getByRole("link", { name: "Customize" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Choose how it rests." })).toBeVisible({ timeout: 15_000 });
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText("Custom designs are preview-only in the local demo. No purchase is simulated.")).toBeVisible();
});

test("mobile home, map, and legal navigation remain reachable without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Lay something to rest" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "List view" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.locator("#cemetery").getByRole("link", { name: /My Weekend App/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await Promise.all([
    page.waitForURL(/\/privacy$/),
    page.getByRole("link", { name: "Privacy" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "What the garden keeps." })).toBeVisible({ timeout: 15_000 });
  await expectNoHorizontalOverflow(page);
});
