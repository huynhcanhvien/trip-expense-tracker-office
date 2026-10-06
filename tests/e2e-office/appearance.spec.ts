import { test, expect } from "@playwright/test";

test("language choice persists across routes and reloads without changing URLs", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await page
    .getByRole("combobox", { name: "Ngôn ngữ", exact: true })
    .selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Office Split", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Privacy", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL("http://localhost:3100/");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", { name: "Privacy policy", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Data processing services",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Terms", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Terms of use", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Payments and confirmation",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("vi");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(
    page.getByRole("link", { name: "Quyền riêng tư", exact: true }),
  ).toBeVisible();
});

test("theme persists and system mode follows the device", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Giao diện", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Tối", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Giao diện", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Sáng", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Giao diện", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "Theo hệ thống", exact: true })
    .click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("public controls support keyboard navigation", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Đến nội dung chính", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Giao diện", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitemradio", { name: "Sáng", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitemradio", { name: "Tối", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "Giao diện", exact: true }),
  ).toBeFocused();
});
