import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import sharp from "sharp";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
);
const base = "http://localhost:3100";
const password = `Test-${randomUUID()}!`;
let admin: SupabaseClient;
const people: { id: string; email: string; name: string }[] = [];

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Đăng nhập", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(base + "/");
}

test.describe("real Supabase office workflow", () => {
  test.skip(
    !configured,
    "Run npm run db:start and node scripts/prepare-e2e.mjs first.",
  );
  test.beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (
      !["localhost", "127.0.0.1"].includes(new URL(url).hostname) &&
      process.env.E2E_ALLOW_REMOTE !== "true"
    ) {
      throw new Error(
        "E2E mutates test data. Only local Supabase is allowed unless E2E_ALLOW_REMOTE=true for an isolated staging project.",
      );
    }
    admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false },
    });
    for (const name of ["Người ứng tiền", "Đồng nghiệp", "Người ngoài nhóm"]) {
      const email = `${randomUUID()}@example.test`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error || !data.user)
        throw new Error("Could not create an isolated E2E account.");
      people.push({ id: data.user.id, email, name });
    }
  });

  test.afterAll(async () => {
    if (!admin || !people.length) return;
    const ids = people.map((person) => person.id);
    const { data: groups } = await admin
      .from("office_groups")
      .select("id")
      .in("owner_id", ids);
    const groupIds = (groups || []).map((group) => group.id);
    if (groupIds.length) {
      const { data: expenses } = await admin
        .from("office_expenses")
        .select("id")
        .in("group_id", groupIds);
      const expenseIds = (expenses || []).map((expense) => expense.id);
      if (expenseIds.length) {
        await admin
          .from("payment_events")
          .delete()
          .in("expense_id", expenseIds);
        await admin.from("office_shares").delete().in("expense_id", expenseIds);
        await admin.from("notifications").delete().in("group_id", groupIds);
        await admin.from("office_expenses").delete().in("id", expenseIds);
      }
      await admin.from("notifications").delete().in("group_id", groupIds);
    }
    await admin.from("notifications").delete().in("user_id", ids);
    await admin.from("bank_profiles").delete().in("user_id", ids);
    const { data: uploads } = await admin
      .from("uploads")
      .select("path,preview_path")
      .in("user_id", ids);
    const paths = (uploads || []).flatMap((upload) =>
      [upload.path, upload.preview_path].filter(Boolean),
    );
    if (paths.length) await admin.storage.from("office-images").remove(paths);
    await admin.from("uploads").delete().in("user_id", ids);
    if (groupIds.length)
      await admin.from("office_groups").delete().in("id", groupIds);
    for (const person of people) await admin.auth.admin.deleteUser(person.id);
    people.length = 0;
  });

  test("approval, bank QR, camera upload, Groq OCR, repayment, cancellation and statistics", async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(180_000);
    const [owner, member, outsider] = people;
    const device = testInfo.project.use;
    const options = {
      viewport: device.viewport,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
      deviceScaleFactor: device.deviceScaleFactor,
      userAgent: device.userAgent,
    };
    const memberContext = await browser.newContext(options);
    const outsideContext = await browser.newContext(options);
    const memberPage = await memberContext.newPage();
    const outsidePage = await outsideContext.newPage();
    try {
      await login(page, owner.email);
      await expect(
        page.getByRole("button", { name: "Đăng xuất", exact: true }),
      ).toBeInViewport();
      if (testInfo.project.name === "mobile") {
        await expect(page.getByTestId("mobile-tab-bar")).toBeVisible();
        await expect(page.getByTestId("desktop-navigation")).toBeHidden();
        for (const label of ["Nhóm", "Thống kê", "Thông báo", "Hồ sơ"]) {
          await expect(
            page
              .getByTestId("mobile-tab-bar")
              .getByRole("link", { name: label, exact: true }),
          ).toBeVisible();
        }
      } else {
        await expect(page.getByTestId("desktop-navigation")).toBeVisible();
        await expect(page.getByTestId("mobile-tab-bar")).toBeHidden();
      }

      const groupName = `Nhóm kiểm thử ${randomUUID().slice(0, 8)}`;
      await page.getByLabel("Tên nhóm", { exact: true }).fill(groupName);
      await page.getByRole("button", { name: "Tạo nhóm", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: groupName }),
      ).toBeVisible();
      const groupId = new URL(page.url()).pathname.split("/").pop()!;
      const { data: group } = await admin
        .from("office_groups")
        .select("invite_token")
        .eq("id", groupId)
        .single();
      expect(group).not.toBeNull();
      const invite = `${base}/invite/${group!.invite_token}`;

      // Anonymous invitation returns to the original invite after login.
      await memberPage.goto(invite);
      await expect(memberPage).toHaveURL(/\/login\?next=/);
      await memberPage.getByLabel("Email", { exact: true }).fill(member.email);
      await memberPage.getByLabel("Mật khẩu", { exact: true }).fill(password);
      await memberPage
        .getByRole("button", { name: "Đăng nhập", exact: true })
        .last()
        .click();
      await expect(
        memberPage.getByRole("heading", { name: groupName }),
      ).toBeVisible();
      await memberPage
        .getByRole("button", { name: "Xin tham gia nhóm" })
        .click();
      await expect(
        memberPage.getByText(
          "Bạn sẽ xem được dữ liệu nhóm sau khi quản trị viên duyệt.",
        ),
      ).toBeVisible();
      await memberPage.goto(`${base}/groups/${groupId}`);
      await expect(
        memberPage.getByRole("heading", { name: "Không tìm thấy nội dung" }),
      ).toBeVisible();

      await page.reload();
      await page.getByRole("button", { name: "Duyệt", exact: true }).click();
      await expect(page.getByText("Yêu cầu tham gia (0)")).toBeVisible();
      await memberPage.goto(`${base}/groups/${groupId}`);
      await expect(
        memberPage.getByRole("heading", { name: groupName }),
      ).toBeVisible();

      await page.goto(`${base}/profile`);
      await page
        .getByLabel("Ngân hàng", { exact: true })
        .fill("Ngân hàng kiểm thử");
      await page.getByLabel("Số tài khoản", { exact: true }).fill("0123456789");
      await page
        .getByLabel("Tên chủ tài khoản", { exact: true })
        .fill("NGUOI UNG TIEN");
      await page
        .getByLabel("Nội dung chuyển khoản mặc định", { exact: true })
        .fill("Hoan tra bua trua");
      const qr = await sharp({
        create: { width: 256, height: 256, channels: 3, background: "white" },
      })
        .png()
        .toBuffer();
      await page
        .locator('input[type="file"]')
        .last()
        .setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: qr });
      await expect(
        page.getByText("Ảnh đã tải xong.", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Lưu ngân hàng", exact: true })
        .click();
      await expect(
        page.getByText("Đã lưu tài khoản ngân hàng.", { exact: true }),
      ).toBeVisible();

      await page.goto(`${base}/groups/${groupId}/expenses/new`);
      await page.getByRole("button", { name: "Chụp / quét hóa đơn" }).click();
      await expect(
        page.getByRole("button", { name: "Chụp hóa đơn", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator('input[capture="environment"]'),
      ).toHaveAttribute("accept", /image/);
      // Original phone image exceeds Vercel's 4.5 MB body limit; upload bypasses Functions.
      const raw = randomBytes(1500 * 1500 * 3);
      const receipt = await sharp(raw, {
        raw: { width: 1500, height: 1500, channels: 3 },
      })
        .png({ compressionLevel: 0 })
        .toBuffer();
      expect(receipt.length).toBeGreaterThan(4.5 * 1024 * 1024);
      await page.locator('input[capture="environment"]').setInputFiles({
        name: "phone-receipt.png",
        mimeType: "image/png",
        buffer: receipt,
      });
      await expect(
        page.getByText("Ảnh đã tải xong.", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Quét hóa đơn", exact: true })
        .click();
      await expect(page.getByLabel("Tổng tiền (VND)")).toHaveValue("101000");
      await expect(page.getByLabel("Mô tả", { exact: true })).toHaveValue(
        "Bữa trưa OCR",
      );
      await page
        .getByRole("button", { name: "Tạo expense", exact: true })
        .click();
      await expect(page).toHaveURL(/\/expenses\/[0-9a-f-]+$/);
      const expenseId = new URL(page.url()).pathname.split("/").pop()!;
      await expect(
        page.getByRole("heading", { name: "Bữa trưa OCR" }),
      ).toBeVisible();
      await expect(
        page.getByText("0123456789", { exact: false }),
      ).toBeVisible();
      const { data: expense } = await admin
        .from("office_expenses")
        .select("receipt_upload_id")
        .eq("id", expenseId)
        .single();
      expect(expense?.receipt_upload_id).toBeTruthy();

      await login(outsidePage, outsider.email);
      await outsidePage.goto(`${base}/expenses/${expenseId}`);
      await expect(
        outsidePage.getByRole("heading", { name: "Không tìm thấy nội dung" }),
      ).toBeVisible();
      const deniedImage = await outsidePage.request.get(
        `${base}/api/uploads/${expense!.receipt_upload_id}`,
      );
      expect(deniedImage.status()).toBe(404);

      await memberPage.goto(`${base}/expenses/${expenseId}`);
      await memberPage
        .getByRole("button", { name: "Tôi đã chuyển tiền" })
        .click();
      await expect(
        memberPage.getByText("Chờ xác nhận", {
          exact: true,
        }),
      ).toBeVisible();
      await page.reload();
      await page
        .getByRole("button", { name: "Xác nhận đã nhận", exact: true })
        .click();
      await expect(page.getByText("Hoàn tất", { exact: true })).toBeVisible();
      await expect(
        page.getByText("1/1 người cần chuyển đã xác nhận", { exact: false }),
      ).toBeVisible();

      await page.goto(
        `${base}/statistics?group=${groupId}&from=2026-10-01&to=2026-10-31`,
      );
      await expect(page.getByText("Tổng chi", { exact: true })).toBeVisible();
      await expect(
        page.getByText("101.000 ₫", { exact: true }).first(),
      ).toBeVisible();
      await expect(page.getByTestId("monthly-chart")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("statistics.png"),
        fullPage: true,
        caret: "initial",
      });

      await page.goto(`${base}/expenses/${expenseId}`);
      await page.getByText("Hủy expense", { exact: true }).first().click();
      await page.getByLabel("Lý do hủy").fill("Nhập nhầm hóa đơn");
      await page
        .getByRole("button", { name: "Hủy expense", exact: true })
        .click();
      await expect(page.getByText("Đã hủy", { exact: true })).toBeVisible();
      await expect(
        page.getByText("Nhập nhầm hóa đơn", { exact: false }).first(),
      ).toBeVisible();
      await page.goto(`${base}/notifications`);
      await expect(
        page.getByRole("heading", { name: "Thông báo" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Đánh dấu tất cả đã đọc" })
        .click();
      await expect(
        page.getByText("Đã đánh dấu đã đọc.", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("notifications.png"),
        fullPage: true,
        caret: "initial",
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
      // A different account in the same browser must not inherit warmed private pages.
      await page.goto(`${base}/`);
      await expect(
        page.getByRole("link").filter({ hasText: groupName }),
      ).toBeVisible();
      await page.goto(`${base}/groups/${groupId}`);
      await page
        .getByRole("button", { name: "Đăng xuất", exact: true })
        .click();
      await login(page, outsider.email);
      await expect(
        page.getByRole("link").filter({ hasText: groupName }),
      ).toHaveCount(0);
      await page.goto(`${base}/groups/${groupId}`);
      await expect(
        page.getByRole("heading", { name: "Không tìm thấy nội dung" }),
      ).toBeVisible();
    } finally {
      await memberContext.close();
      await outsideContext.close();
    }
  });
  test("daily charts, paid-only departure and confirmed group deletion", async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(180_000);
    const [owner, member] = people;
    const memberContext = await browser.newContext({
      viewport: testInfo.project.use.viewport,
    });
    const memberPage = await memberContext.newPage();
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const memberClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const checked = <T>({
      data,
      error,
    }: {
      data: T;
      error: { message: string } | null;
    }) => {
      if (error) throw new Error(error.message);
      return data;
    };
    try {
      for (const [session, person] of [
        [client, owner],
        [memberClient, member],
      ] as const) {
        const { error } = await session.auth.signInWithPassword({
          email: person.email,
          password,
        });
        if (error) throw new Error(error.message);
      }
      const name = `Lifecycle ${randomUUID().slice(0, 8)}`;
      const id = checked(
        await client.rpc("create_group", { p_name: name, p_currency: "VND" }),
      );
      const group = checked(
        await client
          .from("office_groups")
          .select("invite_token")
          .eq("id", id)
          .single(),
      );
      const request = checked(
        await memberClient.rpc("request_join", {
          p_token: group!.invite_token,
        }),
      );
      checked(
        await client.rpc("decide_join", {
          p_request_id: request,
          p_approve: true,
        }),
      );
      const expenseIds: string[] = [];
      for (const [date, amount] of [
        ["2026-09-30", "30000"],
        ["2026-10-01", "70000"],
        ["2026-10-06", "50000"],
      ]) {
        expenseIds.push(
          checked(
            await client.rpc("save_expense", {
              p_expense_id: null,
              p_group_id: id,
              p_description: `Lunch ${date}`,
              p_amount: amount,
              p_expense_date: date,
              p_split_mode: "even",
              p_shares: [{ userId: owner.id }, { userId: member.id }],
              p_receipt_upload_id: null,
            }),
          ),
        );
      }
      await login(page, owner.email);
      await page.goto(`/statistics?group=${id}&from=2026-09-30&to=2026-10-06`);
      const interval = page.getByRole("combobox", {
        name: "Hiển thị theo (VND)",
        exact: true,
      });
      await expect(interval).toHaveValue("month");
      await page.getByText("Số liệu theo tháng", { exact: true }).click();
      let table = page.getByRole("table", {
        name: "Biểu đồ chi tiêu theo tháng (VND)",
      });
      await expect(table.getByRole("row")).toHaveCount(3);
      await expect(table).toContainText("120.000 ₫");
      await interval.selectOption("day");
      await expect(page.getByTestId("monthly-chart")).toHaveAttribute(
        "data-interval",
        "day",
      );
      await expect(
        page.getByRole("heading", { name: "Chi tiêu theo ngày", exact: true }),
      ).toBeVisible();
      table = page.getByRole("table", {
        name: "Biểu đồ chi tiêu theo ngày (VND)",
      });
      await expect(table.getByRole("row")).toHaveCount(4);
      for (const amount of ["30.000 ₫", "70.000 ₫", "50.000 ₫"])
        await expect(table).toContainText(amount);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await interval.selectOption("month");
      await expect(
        page.getByRole("heading", { name: "Chi tiêu theo tháng", exact: true }),
      ).toBeVisible();
      await login(memberPage, member.email);
      await memberPage.goto(`/groups/${id}`);
      await expect(
        memberPage.getByText("Xóa nhóm", { exact: true }),
      ).toHaveCount(0);
      await memberPage.getByText("Rời nhóm", { exact: true }).click();
      await memberPage
        .getByLabel("Tôi muốn rời nhóm này", { exact: true })
        .check();
      await memberPage
        .getByRole("button", { name: "Xác nhận rời nhóm", exact: true })
        .click();
      await expect(
        memberPage.getByRole("main").getByRole("alert"),
      ).toContainText("Bạn cần thanh toán hết");
      await expect(
        memberPage.getByLabel("Tôi muốn rời nhóm này", { exact: true }),
      ).not.toBeChecked();
      for (const expenseId of expenseIds) {
        checked(
          await memberClient.rpc("payment_action", {
            p_expense_id: expenseId,
            p_action: "report",
            p_user_id: member.id,
          }),
        );
      }
      await memberPage
        .getByLabel("Tôi muốn rời nhóm này", { exact: true })
        .check();
      await memberPage
        .getByRole("button", { name: "Xác nhận rời nhóm", exact: true })
        .click();
      await expect(
        memberPage.getByRole("main").getByRole("alert"),
      ).toContainText("được xác nhận");
      await expect(
        memberPage.getByLabel("Tôi muốn rời nhóm này", { exact: true }),
      ).not.toBeChecked();
      for (const expenseId of expenseIds) {
        checked(
          await client.rpc("payment_action", {
            p_expense_id: expenseId,
            p_action: "confirm",
            p_user_id: member.id,
          }),
        );
      }
      await memberPage
        .getByLabel("Tôi muốn rời nhóm này", { exact: true })
        .check();
      await memberPage
        .getByRole("button", { name: "Xác nhận rời nhóm", exact: true })
        .click();
      await expect(memberPage).toHaveURL(base + "/");
      await memberPage.goto(`/groups/${id}`);
      await expect(
        memberPage.getByRole("heading", {
          name: "Không tìm thấy nội dung",
          exact: true,
        }),
      ).toBeVisible();
      await page.goto(`/groups/${id}`);
      await expect(page.getByText("Rời nhóm", { exact: true })).toHaveCount(0);
      await page.getByText("Xóa nhóm", { exact: true }).click();
      const remove = page.getByRole("button", {
        name: "Xóa nhóm vĩnh viễn",
        exact: true,
      });
      await expect(remove).toBeDisabled();
      const confirmation = page.getByLabel("Nhập tên nhóm để xác nhận", {
        exact: true,
      });
      await confirmation.fill("Wrong name");
      await expect(remove).toBeDisabled();
      await confirmation.fill(name);
      await page.getByRole("button", { name: "Giữ nhóm", exact: true }).click();
      await page.getByText("Xóa nhóm", { exact: true }).click();
      await expect(confirmation).toHaveValue("");
      await confirmation.fill(name);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await remove.click();
      await expect(page).toHaveURL(base + "/");
      await expect(page.getByRole("link", { name, exact: true })).toHaveCount(
        0,
      );
      expect(
        checked(await admin.from("office_groups").select("id").eq("id", id)),
      ).toHaveLength(0);
      expect(
        checked(
          await admin.from("office_expenses").select("id").eq("group_id", id),
        ),
      ).toHaveLength(0);
    } finally {
      await memberContext.close();
    }
  });

  test("English dashboard, group, expense, statistics and profile keep the same URLs", async ({
    page,
  }, testInfo) => {
    await login(page, people[0].email);
    await page
      .getByRole("combobox", { name: "Ngôn ngữ", exact: true })
      .selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { name: "Your balance ledger", exact: true }),
    ).toBeVisible();
    async function checkAccessibility() {
      for (const colorScheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        if (colorScheme === "dark")
          await expect(page.locator("html")).toHaveClass(/dark/);
        else await expect(page.locator("html")).not.toHaveClass(/dark/);
        const audit = await new AxeBuilder({ page })
          .exclude("nextjs-portal")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(audit.violations, page.url()).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page.emulateMedia({ colorScheme: "light" });
    }
    await checkAccessibility();
    if (testInfo.project.name === "mobile") {
      const viewport = page.viewportSize()!;
      await page.setViewportSize({ width: 320, height: viewport.height });
      await checkAccessibility();
      const brand = await page
        .getByRole("link", { name: "Office Split", exact: true })
        .boundingBox();
      expect(brand?.width).toBeGreaterThanOrEqual(44);
      expect(brand?.height).toBeGreaterThanOrEqual(44);
      await expect(
        page.getByRole("combobox", { name: "Language", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sign out", exact: true }),
      ).toBeInViewport();
      await expect(
        page
          .getByTestId("mobile-tab-bar")
          .getByRole("link", { name: "Profile", exact: true }),
      ).toBeVisible();
      const terms = await page
        .getByRole("link", { name: "Terms", exact: true })
        .boundingBox();
      expect(terms?.width).toBeGreaterThanOrEqual(44);
      expect(terms?.height).toBeGreaterThanOrEqual(44);
      await page.setViewportSize(viewport);
    }
    const name = `English group ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("Group name", { exact: true }).fill(name);
    await page
      .getByRole("button", { name: "Create group", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await checkAccessibility();
    const groupUrl = page.url();
    await expect(
      page.getByRole("heading", { name: "Join requests (0)", exact: true }),
    ).toBeVisible();
    if (testInfo.project.name === "mobile") {
      await page.getByRole("link", { name: "Manage", exact: true }).click();
      await expect(page).toHaveURL(/#manage$/);
      await expect(
        page.getByRole("heading", { name: "Invite colleagues", exact: true }),
      ).toBeInViewport();
    }
    await page.goto(groupUrl + "/expenses/new");
    await checkAccessibility();
    await page.getByLabel("Description", { exact: true }).fill("English lunch");
    await page.getByLabel("Total amount (VND)", { exact: true }).fill("120000");
    await page.getByLabel("Expense date", { exact: true }).fill("2026-10-05");
    await expect(page.getByTestId("expense-amount-preview")).toHaveText(
      "Amount to save: 120.000 ₫",
    );
    await page
      .getByRole("button", { name: "Create expense", exact: true })
      .click();
    await expect(page).toHaveURL(/\/expenses\/[0-9a-f-]+$/);
    await expect(
      page.getByRole("heading", { name: "English lunch", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Shares and repayments", exact: true }),
    ).toBeVisible();
    await checkAccessibility();
    const groupId = new URL(groupUrl).pathname.split("/").pop();
    await page.goto(
      `/statistics?group=${groupId}&from=2026-10-01&to=2026-10-31`,
    );
    await expect(
      page.getByRole("heading", { name: "Statistics", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("monthly-chart")).toBeVisible();
    await checkAccessibility();
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { name: "Notifications", exact: true }),
    ).toBeVisible();
    await checkAccessibility();
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "Appearance & language", exact: true }),
    ).toBeVisible();
    await checkAccessibility();
    await page.getByLabel("Bank", { exact: true }).fill("Test Bank");
    await page.getByLabel("Account number", { exact: true }).fill("0123456789");
    await page
      .getByLabel("Account holder name", { exact: true })
      .fill("TEST ACCOUNT");
    await page
      .getByRole("button", { name: "Save bank account", exact: true })
      .click();
    await expect(
      page.getByText("Bank account saved.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
