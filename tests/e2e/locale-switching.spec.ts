import { expect, test } from "@playwright/test";

test("switches the complete shell between English and Japanese and persists the choice", async ({ page, context }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle(/A resting place for unfinished things/);
  await expect(page.getByRole("heading", { name: /A resting place for unfinished things/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "EN", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page).toHaveTitle(/未完成のものが眠る場所/);
  await expect(page.getByRole("heading", { name: "未完成のものが眠る場所。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "日本語" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "一覧表示" }).click();
  await expect(page.locator("#cemetery").getByRole("link", { name: /週末アプリ/ })).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByRole("heading", { name: "未完成のものが眠る場所。" })).toBeVisible();

  const secondPage = await context.newPage();
  await secondPage.goto("/privacy");
  await expect(secondPage.locator("html")).toHaveAttribute("lang", "ja");
  await expect(secondPage).toHaveTitle(/プライバシー/);
  await expect(secondPage.getByRole("heading", { name: "この庭が保存するもの。" })).toBeVisible();
  await expect(secondPage.getByText(/言語設定Cookieは英語または日本語の選択を1年間保存します/)).toBeVisible();

  await secondPage.getByRole("button", { name: "EN", exact: true }).click();
  await expect(secondPage.locator("html")).toHaveAttribute("lang", "en");
  await expect(secondPage.getByRole("heading", { name: "What the garden keeps." })).toBeVisible();
});

test("language switching preserves an in-progress grave draft, query, and fragment", async ({ page }) => {
  await page.goto("/create?plot=4#unfinished-draft");
  const title = page.getByLabel("Project name");
  await title.fill("途中の日本語プロジェクト");
  await expect(page.getByText("Plot 5", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByRole("heading", { name: "未完成のものを、静かに眠らせる。" })).toBeVisible();
  await expect(page.getByLabel("プロジェクト名")).toHaveValue("途中の日本語プロジェクト");
  await expect(page.getByText("区画 5", { exact: true })).toBeVisible();
  expect(page.url()).toContain("/create?plot=4#unfinished-draft");

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel("Project name")).toHaveValue("途中の日本語プロジェクト");
});

test("validation feedback never remains in the previous language", async ({ page }) => {
  await page.goto("/create?plot=4");
  await expect(page.getByText("Plot 5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lay it to rest" }).click();
  await expect(page.getByText("Enter a project name.")).toBeVisible();

  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByText("Enter a project name.")).toHaveCount(0);
  await page.getByRole("button", { name: "静かに眠らせる" }).click();
  await expect(page.getByText("プロジェクト名を入力してください。")).toBeVisible();
});

test("Japanese mode keeps user-authored text unchanged and remains usable at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByRole("button", { name: "日本語" })).toBeEnabled();

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  await page.goto("/create?plot=5");
  await expect(page.getByText("区画 6", { exact: true })).toBeVisible();
  await page.getByLabel("プロジェクト名").fill("日本語の作品名");
  await page.getByLabel("別れの言葉（任意）").fill("この文章は翻訳せず、そのまま残します。");
  await page.getByRole("button", { name: "静かに眠らせる" }).click();
  await expect(page.getByRole("heading", { name: "あなたのプロジェクトの居場所ができました。" })).toBeVisible();
  await page.getByRole("link", { name: "墓碑を見る" }).click();
  await expect(page.getByRole("heading", { name: "日本語の作品名" })).toBeVisible();
  await expect(page.getByRole("blockquote")).toHaveText("この文章は翻訳せず、そのまま残します。");
});

test("language switching preserves unsaved edit and headstone choices", async ({ page }) => {
  await page.goto("/create?plot=10");
  await page.getByLabel("Project name").fill("Draft preservation grave");
  await page.getByRole("button", { name: "Lay it to rest" }).click();
  await page.getByRole("link", { name: "Visit the grave" }).click();
  await page.getByRole("link", { name: "Edit this grave" }).click();

  await page.getByLabel("Project name").fill("Unsaved 日本語 edit");
  await page.getByLabel("A few parting words, optional").fill("Keep this unsaved sentence.");
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByLabel("プロジェクト名")).toHaveValue("Unsaved 日本語 edit");
  await expect(page.getByLabel("別れの言葉（任意）")).toHaveValue("Keep this unsaved sentence.");

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("link", { name: "Preview three additional headstones →" }).click();
  await page.getByRole("button", { name: /Moss/ }).click();
  await page.getByRole("button", { name: "Use Sage" }).click();
  await expect(page.getByRole("button", { name: /Moss/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Use Sage" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByRole("button", { name: /苔/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "セージを使う" })).toHaveAttribute("aria-pressed", "true");
});
