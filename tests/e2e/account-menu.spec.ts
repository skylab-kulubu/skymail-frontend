/**
 * The person's menu sits at the top right, as in every club console (top bar
 * standard, 2026-11-23): the person, Hesap merkezi, Tema, Çıkış yap. The
 * sidebar carries no account row. On phones the avatar is in the sticky top
 * bar, not in the drawer. This server's API address is not the sandbox's, so
 * no sandbox badge.
 */
import { expect, test } from "./fixtures";
import { VIEWER } from "./fixtures/session";

const NAME = "Deneme Operatör";

test("the account menu opens from the avatar at the top right", async ({ page, skymail, signIn }) => {
  void skymail;
  await signIn("sender");
  await page.goto("/");

  const trigger = page.getByRole("button", { name: `Hesap: ${NAME}` });
  await expect(trigger).toBeVisible();
  const box = (await trigger.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThan(viewport.width - 120);
  expect(box.y).toBeLessThan(60);

  const sidebar = page.getByRole("complementary");
  await expect(sidebar.getByText(NAME)).toHaveCount(0);
  await expect(sidebar.getByText(VIEWER.email)).toHaveCount(0);
  await expect(page.getByRole("note", { name: "Ortam: Sandbox" })).toHaveCount(0);

  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText(NAME);
  await expect(menu).toContainText(VIEWER.email);
  await expect(menu.getByRole("menuitem")).toHaveText(["Hesap merkezi", "Tema", "Çıkış yap"]);
  await expect(menu.getByRole("menuitem", { name: "Hesap merkezi" })).toHaveAttribute("href", "https://my.yildizskylab.com");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the avatar stays in the top bar and the drawer has no account row", async ({ page, skymail, signIn }) => {
    void skymail;
    await signIn("sender");
    await page.goto("/");

    await expect(page.getByRole("button", { name: `Hesap: ${NAME}` })).toBeVisible();
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: "Ana sayfa" })).toBeVisible();
    await expect(drawer.getByText(NAME)).toHaveCount(0);
  });
});
