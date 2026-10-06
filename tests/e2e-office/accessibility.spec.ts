import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

for (const locale of ["vi", "en"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`public pages satisfy WCAG AA in ${locale}, ${theme}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(180_000);
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: "http://localhost:3100" },
        ]);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      for (const route of [
        "/",
        "/login",
        "/privacy",
        "/terms",
        "/content-that-does-not-exist",
      ]) {
        await page.goto(route);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        if (theme === "dark")
          await expect(page.locator("html")).toHaveClass(/dark/);
        const result = await new AxeBuilder({ page })
          .exclude("nextjs-portal")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          result.violations,
          `${route}: ${JSON.stringify(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) })))}`,
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          route,
        ).toBe(true);
        if (route === "/")
          await page.screenshot({
            path: testInfo.outputPath(`${locale}-${theme}.png`),
            fullPage: true,
            caret: "initial",
          });
      }
    });
  }
}
