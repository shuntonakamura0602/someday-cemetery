import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({}, testInfo) => {
  testInfo.setTimeout(60_000);
});

async function openCreate(page: Page) {
  await page.goto("/create");
  await expect(page.getByRole("heading", { name: "Lay something to rest." })).toBeVisible();
  await expect(page.getByRole("grid", { name: "One hundred cemetery plots" })).toBeVisible();
  await expect(page.getByText("No plot chosen", { exact: true })).toBeVisible();
}

async function createDemoGrave(
  page: Page,
  options: { title?: string; epitaph?: string; plot?: number } = {},
) {
  await openCreate(page);
  const plot = options.plot ?? 1;
  const openPlot = page.getByRole("gridcell", {
    name: new RegExp(`Plot ${plot}: open resting place`, "i"),
  });
  if (await openPlot.getAttribute("aria-selected") !== "true") {
    await openPlot.click();
  }
  await page.getByLabel("Project name").fill(options.title ?? "My Quiet Prototype");
  if (options.epitaph) {
    await page.getByLabel("A few parting words, optional").fill(options.epitaph);
  }
  await page.getByRole("button", { name: "Lay it to rest" }).click();
  await expect(page.getByRole("heading", { name: "Your project has a place here." })).toBeVisible();
  const publicHref = await page.getByRole("link", { name: "Visit the grave" }).getAttribute("href");
  expect(publicHref).toMatch(/^\/g\/[0-9a-f-]{36}$/i);
  return publicHref!;
}

test("UX01 and UX09: the English cemetery is readable without registration and examples are explicit", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Demo — changes stay in this browser")).toBeVisible();
  await expect(page.getByRole("heading", { name: /A resting place for unfinished things/i })).toBeVisible();
  await expect(page.getByText("The app you never shipped. The novel you never finished. The plans you quietly outgrew.")).toBeVisible();
  await expect(page.getByRole("grid", { name: "One hundred cemetery plots" })).toBeVisible();

  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.locator("#cemetery").getByRole("link", { name: /My Weekend App/i })).toBeVisible();
  await expect(page.getByText("Example", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "A few example epitaphs" })).toBeVisible();
});

test("UX02 and UX08: a title-only grave gets a public URL separate from its recovery secret", async ({ page, context }) => {
  const publicHref = await createDemoGrave(page, { title: "The Tiny Compiler", plot: 1 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });

  const publicCode = await page.locator(".created-link-card").filter({ hasText: "Public link" }).locator("code").textContent();
  const recoveryCode = await page.locator(".recovery-card .secret-code").textContent();
  expect(publicCode).toContain(publicHref);
  expect(publicCode).not.toContain("#");
  expect(publicCode).not.toContain("key=");
  expect(recoveryCode).toContain("/recover#grave=");
  expect(recoveryCode).toContain("&key=");

  await page.getByRole("button", { name: "Copy public link" }).click();
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toMatch(/\/g\/[0-9a-f-]{36}$/i);
  expect(clipboard).not.toContain("#");
  expect(clipboard).not.toContain("key=");

  await Promise.all([
    page.waitForURL(new RegExp(`${publicHref}$`)),
    page.getByRole("link", { name: "Visit the grave" }).click(),
  ]);
  await expect(page).toHaveURL(new RegExp(`${publicHref}$`));
  await expect(page.getByRole("heading", { name: "The Tiny Compiler" })).toBeVisible();
  await expect(page.getByText("This grave belongs to this browser")).toBeVisible();
});

test("free owner journey supports one flower, image download, and editing", async ({ page }) => {
  const publicHref = await createDemoGrave(page, {
    title: "The Garden Sketch",
    epitaph: "It taught me where the path should go.",
    plot: 2,
  });
  await page.goto(publicHref);

  await page.getByRole("button", { name: "Leave a flower" }).click();
  await expect(page.getByRole("button", { name: "Flower left" })).toBeVisible();
  await expect(page.getByText("1", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download image" }).click();
  const image = await download;
  expect(image.suggestedFilename()).toMatch(/^someday-cemetery-.*\.png$/);

  await Promise.all([
    page.waitForURL(new RegExp(`${publicHref}/edit$`)),
    page.getByRole("link", { name: "Edit this grave" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Edit this grave." })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Project name").fill("The Garden Sketch, Revised");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
  await Promise.all([
    page.waitForURL(new RegExp(`${publicHref}$`)),
    page.getByRole("link", { name: "Back to the grave" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "The Garden Sketch, Revised" })).toBeVisible();

  await page.goto("/my-graves");
  const ownedGrave = page.locator(".owner-grave-card").filter({ hasText: "The Garden Sketch, Revised" });
  await expect(page.getByRole("heading", { name: "My graves" })).toBeVisible();
  await expect(ownedGrave).toBeVisible();
  await expect(ownedGrave.getByRole("link", { name: "Edit" })).toHaveAttribute("href", `${publicHref}/edit`);
});

test("UX10: zero real posts and zero owned graves have useful empty states", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A few example epitaphs" })).toBeVisible();

  await page.goto("/my-graves");
  await expect(page.getByRole("heading", { name: "Nothing here yet." })).toBeVisible();
  await expect(page.getByText("You have not laid anything to rest in this browser.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Use a recovery link" })).toBeVisible();
});
