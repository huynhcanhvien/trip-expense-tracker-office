import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import QRCode from "qrcode";
import { crc16 } from "../../src/lib/vietqr";
import { lowContrastQr, qrSheet, stylizedQrScreenshot } from "./stylized-qr";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
);
const base = "http://localhost:3100";
const password = `Test-${randomUUID()}!`;
let admin: SupabaseClient;
const people: { id: string; email: string; name: string }[] = [];
let groupId = "";

async function signedIn(browser: Browser, index: number): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(people[index].email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Đăng nhập", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(base + "/");
  return page;
}
async function userClient(index: number) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email: people[index].email,
    password,
  });
  if (error) throw error;
  return client;
}
const noAxeViolations = async (page: Page) =>
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

test.describe("payer approval, VietQR, reminders, categories and recurring", () => {
  test.skip(!configured, "Run local Supabase and prepare-e2e first.");
  test.beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
      throw new Error("E2E mutates data; only local Supabase is allowed.");
    admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false },
    });
    for (const name of ["Người tạo", "Người trả", "Người nợ"]) {
      const email = `${randomUUID()}@example.test`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error || !data.user) throw new Error("Could not create E2E user.");
      people.push({ id: data.user.id, email, name });
    }
    // Group setup goes through the real RPCs as each user.
    const [creator, payer, debtor] = await Promise.all(
      [0, 1, 2].map(userClient),
    );
    const created = await creator.rpc("create_group", {
      p_name: `Nhóm ${randomUUID().slice(0, 6)}`,
      p_currency: "VND",
    });
    if (created.error) throw created.error;
    groupId = created.data as string;
    const { data: group } = await admin
      .from("office_groups")
      .select("invite_token")
      .eq("id", groupId)
      .single();
    for (const client of [payer, debtor]) {
      const request = await client.rpc("request_join", {
        p_token: group!.invite_token,
      });
      if (request.error) throw request.error;
      const decided = await creator.rpc("decide_join", {
        p_request_id: request.data,
        p_approve: true,
      });
      if (decided.error) throw decided.error;
    }
  });

  test.afterAll(async () => {
    if (!admin || !people.length) return;
    const ids = people.map((p) => p.id);
    if (groupId) {
      const { data: expenses } = await admin
        .from("office_expenses")
        .select("id")
        .eq("group_id", groupId);
      const expenseIds = (expenses || []).map((e) => e.id);
      if (expenseIds.length) {
        await admin
          .from("payment_events")
          .delete()
          .in("expense_id", expenseIds);
        await admin.from("office_shares").delete().in("expense_id", expenseIds);
        await admin.from("notifications").delete().eq("group_id", groupId);
        await admin.from("office_expenses").delete().in("id", expenseIds);
      }
      await admin.from("notifications").delete().eq("group_id", groupId);
      await admin.from("office_groups").delete().eq("id", groupId);
    }
    await admin.from("notifications").delete().in("user_id", ids);
    await admin.from("bank_profiles").delete().in("user_id", ids);
    const { data: uploads } = await admin
      .from("uploads")
      .select("path,preview_path")
      .in("user_id", ids);
    const paths = (uploads || []).flatMap((u) =>
      [u.path, u.preview_path].filter(Boolean),
    );
    if (paths.length) await admin.storage.from("office-images").remove(paths);
    await admin.from("uploads").delete().in("user_id", ids);
    for (const person of people) await admin.auth.admin.deleteUser(person.id);
    people.length = 0;
  });

  test("full flow across three members", async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const [, payer, debtor] = people;

    // Payer: bank details fill themselves from an uploaded VietQR image.
    const payerPage = await signedIn(browser, 1);
    await payerPage.goto("/profile");
    // File inputs only react once the page has hydrated.
    await payerPage.waitForLoadState("networkidle");
    // Members may type first (even a placeholder); the QR then corrects the
    // bank and account number but keeps the typed holder name, which most
    // bank QRs do not carry.
    await payerPage.getByLabel("Số tài khoản", { exact: true }).fill("XXXX");
    await payerPage
      .getByLabel("Tên chủ tài khoản", { exact: true })
      .fill("NGUOI TRA");
    // A static VietQR (no amount), like the ones banks print for an account.
    const body =
      "00020101021138570010A00000072701270006970436011300110012345670208QRIBFTTA53037045802VN6304";
    const staticQr = await QRCode.toBuffer(body + crc16(body), {
      width: 480,
      margin: 4,
    });
    await payerPage.locator('input[type="file"]').last().setInputFiles({
      name: "qr.png",
      mimeType: "image/png",
      buffer: staticQr,
    });
    await expect(
      payerPage.getByText(
        "Đã điền thông tin từ mã QR. Vui lòng kiểm tra trước khi lưu.",
      ),
    ).toBeVisible();
    await expect(
      payerPage.getByLabel("Ngân hàng", { exact: true }),
    ).toHaveValue("Vietcombank");
    await expect(
      payerPage.getByLabel("Số tài khoản", { exact: true }),
    ).toHaveValue("0011001234567");
    await expect(
      payerPage.getByLabel("Tên chủ tài khoản", { exact: true }),
    ).toHaveValue("NGUOI TRA");
    await expect(payerPage.getByText("Ảnh đã tải xong.")).toBeVisible();
    await payerPage
      .getByRole("button", { name: "Lưu ngân hàng", exact: true })
      .click();
    await expect(
      payerPage.getByText("Đã lưu tài khoản ngân hàng.", { exact: true }),
    ).toBeVisible();

    // Creator records an expense paid by the payer, split by portions.
    const creatorPage = await signedIn(browser, 0);
    await creatorPage.goto(`/groups/${groupId}/expenses/new`);
    await creatorPage.getByLabel("Mô tả", { exact: true }).fill("Taxi sân bay");
    await creatorPage
      .getByLabel("Danh mục", { exact: true })
      .selectOption("transport");
    await creatorPage
      .getByLabel("Tổng tiền (VND)", { exact: true })
      .fill("300000");
    await creatorPage
      .getByLabel("Người trả tiền", { exact: true })
      .selectOption({ label: payer.name });
    await expect(
      creatorPage.getByText(`${payer.name} cần duyệt`),
    ).toBeVisible();
    await creatorPage
      .getByLabel("Cách chia", { exact: true })
      .selectOption("weight");
    await creatorPage.getByRole("checkbox", { name: payer.name }).uncheck();
    await creatorPage
      .getByLabel(`Số phần của ${debtor.name}`, { exact: true })
      .fill("2");
    await expect(creatorPage.getByText("200.000 ₫")).toBeVisible();
    await expect(creatorPage.getByText("100.000 ₫")).toBeVisible();
    await creatorPage
      .getByRole("button", { name: "Tạo expense", exact: true })
      .click();
    await expect(creatorPage).toHaveURL(/\/expenses\/[0-9a-f-]{36}$/);
    const expenseUrl = creatorPage.url();
    await expect(
      creatorPage.getByText(`Đang chờ ${payer.name} duyệt`),
    ).toBeVisible();
    await expect(
      creatorPage.getByText("Đi lại", { exact: true }),
    ).toBeVisible();

    // Payer approves from the "Needs approval" filter.
    await payerPage.goto("/notifications?filter=approvals");
    await payerPage.getByRole("link", { name: /Taxi sân bay/ }).click();
    await expect(payerPage).toHaveURL(expenseUrl);
    await expect(
      payerPage.getByRole("heading", { name: "Bạn đã trả khoản này?" }),
    ).toBeVisible();
    await noAxeViolations(payerPage);
    await payerPage
      .getByRole("button", { name: "Duyệt, tôi đã trả", exact: true })
      .click();
    // The approval box disappears once approved; the expense starts collecting.
    await expect(
      payerPage.getByRole("heading", { name: "Bạn đã trả khoản này?" }),
    ).toHaveCount(0);
    await expect(payerPage.getByText("Đang thu").first()).toBeVisible();
    // The creator's open page updates live, without a reload.
    await expect(
      creatorPage.getByText(`Đang chờ ${payer.name} duyệt`),
    ).toHaveCount(0, { timeout: 20_000 });

    // Debtor sees what to pay, with a QR carrying the exact amount.
    const debtorPage = await signedIn(browser, 2);
    await expect(
      debtorPage
        .getByTestId(
          testInfo.project.name === "mobile"
            ? "mobile-tab-bar"
            : "desktop-navigation",
        )
        .getByLabel("1 khoản cần trả, 0 khoản cần xác nhận, 0 khoản cần duyệt"),
    ).toBeVisible();
    await debtorPage.goto("/notifications?filter=toPay");
    await expect(debtorPage.getByText(`Trả cho ${payer.name}`)).toBeVisible();
    await noAxeViolations(debtorPage);
    await debtorPage.getByRole("link", { name: /Taxi sân bay/ }).click();
    await expect(
      debtorPage.getByRole("img", {
        name: "Mã QR thanh toán phần của bạn: 200.000 ₫",
      }),
    ).toBeVisible();

    // Payer reminds once; the button then hides for 20 hours (the database
    // also refuses repeats, covered by tests/database-extras.test.ts).
    await payerPage.reload();
    const remind = payerPage.getByRole("button", {
      name: `Nhắc ${debtor.name}`,
      exact: true,
    });
    await remind.click();
    await expect(remind).toHaveCount(0);
    await debtorPage.goto("/notifications");
    await expect(
      debtorPage.getByText("Nhắc: bạn còn khoản cần trả").first(),
    ).toBeVisible();
    await debtorPage.goBack();

    // Debtor reports; only the payer can confirm.
    await debtorPage
      .getByRole("button", { name: "Tôi đã chuyển tiền", exact: true })
      .click();
    await creatorPage.reload();
    await expect(
      creatorPage.getByRole("button", { name: "Xác nhận đã nhận" }),
    ).toHaveCount(0);
    // The payer finds it under "To confirm" and the badge counts it.
    await payerPage.goto("/notifications?filter=toConfirm");
    await expect(
      payerPage.getByText(`${debtor.name} báo đã chuyển`),
    ).toBeVisible();
    await noAxeViolations(payerPage);
    await payerPage.getByRole("link", { name: /Taxi sân bay/ }).click();
    await payerPage
      .getByRole("button", { name: "Xác nhận đã nhận", exact: true })
      .click();
    await expect(
      payerPage.getByText("Đã xác nhận", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      payerPage.getByRole("heading", { name: "Nhật ký thay đổi" }),
    ).toBeVisible();
    await expect(payerPage.getByText("Người trả đã duyệt")).toBeVisible();

    // Statistics by category and CSV export for the creator.
    await creatorPage.goto(
      `/statistics?group=${groupId}&from=2000-01-01&to=2100-01-01`,
    );
    await expect(
      creatorPage.getByRole("heading", { name: "Chi tiêu theo danh mục" }),
    ).toBeVisible();
    const download = creatorPage.waitForEvent("download");
    await creatorPage.getByRole("link", { name: "Xuất CSV" }).click();
    const csv = await readFile((await (await download).path())!, "utf8");
    expect(csv.startsWith("\uFEFFNgày,Nhóm,Mô tả")).toBe(true);
    expect(csv).toContain("Taxi sân bay,Đi lại");
    expect(csv).toContain(debtor.name);

    // Recurring schedule for the group.
    await creatorPage.goto(`/groups/${groupId}/recurring`);
    await creatorPage.getByLabel("Mô tả", { exact: true }).fill("Tiền nước");
    await creatorPage
      .getByLabel("Số tiền (VND)", { exact: true })
      .fill("90000");
    await creatorPage
      .getByRole("button", { name: "Lưu lịch", exact: true })
      .click();
    await expect(
      creatorPage.getByText("Đã lưu khoản chi định kỳ."),
    ).toBeVisible();
    await expect(creatorPage.getByText(/Lần tới:/)).toBeVisible();
    await noAxeViolations(creatorPage);
    await creatorPage
      .getByRole("button", { name: "Dừng", exact: true })
      .click();
    await expect(
      creatorPage.getByText("Đã dừng", { exact: true }),
    ).toBeVisible();
  });

  test("QR from a bank name without BIN, then auto-confirm after 48 hours", async ({
    browser,
  }) => {
    const [, payer, debtor] = people;
    // A profile saved before BINs existed: only the bank's abbreviation.
    const saved = await admin.from("bank_profiles").upsert({
      user_id: payer.id,
      bank_name: "VCB",
      bank_bin: null,
      account_number: "0011-0012-34567",
      account_holder: "NGUYEN VAN A",
      transfer_template: "",
      qr_upload_id: null,
    });
    if (saved.error) throw saved.error;
    const payerClient = await userClient(1);
    const created = await payerClient.rpc("save_expense", {
      p_expense_id: null,
      p_group_id: groupId,
      p_description: "Cà phê tự xác nhận",
      p_amount: "200000",
      p_expense_date: "2026-10-29",
      p_split_mode: "even",
      p_shares: [{ userId: payer.id }, { userId: debtor.id }],
      p_payer_id: payer.id,
      p_category: "food",
    });
    if (created.error) throw created.error;
    const expenseId = created.data as string;

    const debtorPage = await signedIn(browser, 2);
    await debtorPage.goto(`/expenses/${expenseId}`);
    await expect(
      debtorPage.getByRole("img", {
        name: "Mã QR thanh toán phần của bạn: 100.000 ₫",
      }),
    ).toBeVisible();

    await debtorPage
      .getByRole("button", { name: "Tôi đã chuyển tiền", exact: true })
      .click();
    await expect(debtorPage.getByText(/Tự động xác nhận lúc/)).toBeVisible();

    // The payer never answers; pretend the report is 49 hours old.
    const backdated = await admin
      .from("office_shares")
      .update({
        reported_at: new Date(Date.now() - 49 * 3_600_000).toISOString(),
      })
      .eq("expense_id", expenseId)
      .eq("user_id", debtor.id);
    if (backdated.error) throw backdated.error;
    await debtorPage.reload();
    await expect(
      debtorPage.getByText("Tự động xác nhận (48 giờ)").first(),
    ).toBeVisible();
    const { data: share } = await admin
      .from("office_shares")
      .select("payment_status")
      .eq("expense_id", expenseId)
      .eq("user_id", debtor.id)
      .single();
    expect(share?.payment_status).toBe("confirmed");
    const { data: notes } = await admin
      .from("notifications")
      .select("title")
      .eq("expense_id", expenseId)
      .eq("user_id", payer.id);
    expect(notes?.map((n) => n.title)).toContain(
      "Khoản chuyển tiền đã được tự động xác nhận sau 48 giờ",
    );
  });

  test("reads a bank-app QR drawn with round dots on upload", async ({
    browser,
  }) => {
    const page = await signedIn(browser, 2);
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    // VietinBank screenshots draw modules as dots and finders as rings.
    const body =
      "00020101021138580010A000000727012800069704150114123456789012340208QRIBFTTA53037045802VN6304";
    await page
      .locator('input[type="file"]')
      .last()
      .setInputFiles({
        name: "vietinbank.jpg",
        mimeType: "image/jpeg",
        buffer: await stylizedQrScreenshot(body + crc16(body)),
      });
    await expect(
      page.getByText(
        "Đã điền thông tin từ mã QR. Vui lòng kiểm tra trước khi lưu.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Ngân hàng", { exact: true })).toHaveValue(
      "VietinBank",
    );
    await expect(page.getByLabel("Số tài khoản", { exact: true })).toHaveValue(
      "12345678901234",
    );
  });

  test("reads faded QRs, picks the bank QR next to a wallet QR and explains wallet-only QRs", async ({
    browser,
  }) => {
    const page = await signedIn(browser, 2);
    const body =
      "00020101021138580010A000000727012800069704150114123456789012340208QRIBFTTA53037045802VN6304";
    const bankQr = body + crc16(body);
    const walletQr = "2|99|0901234567|NGUYEN VAN A||0|0|0";
    const upload = async (name: string, buffer: Buffer) => {
      await page.goto("/profile");
      await page.waitForLoadState("networkidle");
      await page
        .locator('input[type="file"]')
        .last()
        .setInputFiles({ name, mimeType: "image/jpeg", buffer });
      // Leaving mid-upload would cancel requests and log server errors.
      await expect(page.getByText("Ảnh đã tải xong.")).toBeVisible();
    };
    const filled = page.getByText(
      "Đã điền thông tin từ mã QR. Vui lòng kiểm tra trước khi lưu.",
    );
    const account = page.getByLabel("Số tài khoản", { exact: true });

    await upload("faded.jpg", await lowContrastQr(bankQr));
    await expect(filled).toBeVisible();
    await expect(account).toHaveValue("12345678901234");

    await upload("wallet-and-bank.jpg", await qrSheet([walletQr, bankQr]));
    await expect(filled).toBeVisible();
    await expect(account).toHaveValue("12345678901234");

    await upload("wallet.jpg", await qrSheet([walletQr]));
    await expect(
      page.getByText(/không phải mã chuyển khoản ngân hàng/),
    ).toBeVisible();
  });
});
