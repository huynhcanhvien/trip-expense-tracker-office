# 04 — UI redesign (handoff)

Trạng thái: **Phase 0–5 đã triển khai và kiểm chứng** (2026-10-06).
Branch: `feat/ui-redesign`; phát hành qua PR vào `main` theo yêu cầu ngày 2026-10-06.

Toàn bộ route đang dùng UI Warm ledger, có Việt/English, ngày theo locale,
light/dark/system và bố cục desktop/mobile. Dashboard dùng số dư thật tách theo
tiền tệ; nhóm có anchor sticky và aside; thống kê có Recharts tải riêng cùng bảng
số liệu và card thành viên trên mobile. CSS/icon legacy đã xoá. Chuỗi server và
logic Supabase/URL được giữ nguyên.

Lighthouse đạt các ngưỡng khi đo **mobile DevTools throttling trực tiếp**. Mô
phỏng Lantern có LCP cao hơn; cả hai bộ số được ghi ở §8 và `04-ui-audit.json`.

## 1. Yêu cầu

- Thiết kế lại toàn bộ giao diện, tối ưu cho cả PC và mobile. Logic nghiệp vụ, Supabase và URL giữ nguyên.
- Theme **Sáng / Tối / Theo hệ thống**: có lưu lựa chọn, không nháy màu khi tải trang.
- **Tiếng Việt (mặc định) + English**, đổi được ngay trên giao diện. Ngày tháng hiển thị theo ngôn ngữ đang chọn.
- Tông màu thân thiện, dùng framework UI đẹp nhưng phải tuỳ biến, không để giống template mặc định.

## 2. Các quyết định đã chốt

| Mục               | Quyết định                                                                                                                          | Ghi chú                                                                                                                                                                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Styling           | **Tailwind CSS v4** (`@tailwindcss/postcss`, `tw-animate-css`)                                                                      | Token CSS-first trong `src/app/globals.css`, dark mode qua class `.dark` (`@custom-variant dark`)                                                                                                                                                                                                                 |
| Component         | Tự viết theo kiểu shadcn: **radix-ui** + **class-variance-authority** + **clsx** + **tailwind-merge**                               | Không dùng shadcn CLI. Primitives đặt tại `src/app/components/ui/`                                                                                                                                                                                                                                                |
| Icon              | **lucide-react** (v1.x)                                                                                                             | Thay `OfficeIcon.tsx` rồi xoá file này. Đã kiểm tra có đủ: Wallet, Users, ChartColumn, Bell, User, LogOut, Receipt, Check, ArrowRight/Left, Plus, ShieldCheck, Camera, Landmark, Smartphone, Sun, Moon, Monitor, Languages, Copy, ScanLine, QrCode, History, Inbox, CircleCheckBig, Hourglass, Ban…               |
| Theme             | **next-themes** (`attribute="class"`, `defaultTheme="system"`)                                                                      | `<html suppressHydrationWarning>`                                                                                                                                                                                                                                                                                 |
| i18n              | **next-intl** v4, **không dùng i18n routing**, locale đọc từ cookie `NEXT_LOCALE`                                                   | URL không đổi, nên link mời và OAuth callback vẫn chạy. **Mặc định luôn là `vi` khi chưa có cookie, không đọc `Accept-Language`**: Playwright gửi `en-US`, và E2E đang dùng selector tiếng Việt                                                                                                                   |
| Biểu đồ           | **recharts** (đã cài)                                                                                                               | Chỉ dùng ở `/statistics`, client component lazy-load. Skill `dataviz` không có trong session; dùng BarChart trục zero, tooltip tiền chính xác và bảng số liệu tương đương                                                                                                                                         |
| Font              | **Be Vietnam Pro** tự host (`next/font/local`, 400/700) → `--font-display`; **Geist Mono** → `--font-code`                          | Latin/Latin Extended/Vietnamese gộp thành hai WOFF2 (39,768 bytes); OFL ở `src/app/fonts`. Font optional với fallback đã chỉnh metric; Geist không preload. Số tiền dùng `.tabular`, không dùng mono                                                                                                              |
| Đã bỏ             | `vaul`, `sonner` (đã gỡ)                                                                                                            | Form để inline (xem các ràng buộc ở §5). Thông báo kết quả hiển thị inline, không dùng toast                                                                                                                                                                                                                      |
| Chuỗi phía server | **Kiểu gettext**: giữ nguyên chuỗi tiếng Việt ở server làm khoá, map sang EN ở client bằng `localizeServerMessage(message, locale)` | Không cần sửa `office-actions.ts`, `auth/actions.ts`, `money-input.ts`, API `_shared.ts`, `office-ocr.ts`, nên unit test hiện có giữ nguyên. Dùng regex cho các chuỗi có tham số (`"… không quá 5 MB."`, `"tối đa {dp} chữ số thập phân"`). Lý do không đưa vào JSON: next-intl coi dấu `.` trong key là phân cấp |

### Design direction: "Warm ledger"

- Nền màu giấy kem, chữ màu mực ấm. Primary **teal** dùng cho hành động liên quan tới tiền, accent **coral/peach** cho điểm nhấn thân thiện. Màu trạng thái chỉ mang nghĩa (success / warning / danger).
- Token đã định nghĩa đủ light + dark trong `globals.css`: background, surface, muted, border, input, primary(+hover/soft), accent(+soft), success/warning/danger(+soft), ring, shadow-soft/lift, radius sm→2xl, `animate-rise`, `.app-backdrop` (radial glow), `.tabular`, `.pb-safe`.
- Ý tưởng hình ảnh:
  - Thẻ "balance hero" dùng gradient teal trên dashboard.
  - Avatar nhóm có màu suy ra từ hash tên, chọn trong 6 tông thân thiện.
  - Badge trạng thái có chấm màu.
  - Bottom tab bar trên mobile dạng viên thuốc nổi, nền blur, chừa safe-area.
  - Sidebar desktop dạng thẻ nổi trên nền kem.
- Animation chỉ dùng transform/opacity. `prefers-reduced-motion` đã có sẵn.

## 3. Bố cục mục tiêu

- **PC ≥1024px**:
  - Sidebar cố định (brand, nav, tip, account + nút Đăng xuất). Topbar gồm ThemeToggle, LocaleSwitcher, avatar → `/profile`. Nội dung rộng tối đa khoảng 1200px.
  - Trang nhóm: danh sách chi tiêu (2/3), aside sticky bên phải (thành viên, mời, yêu cầu, cài đặt).
  - Trang khoản chi: tiến độ và các phần chia + lịch sử bên trái; chuyển khoản/QR, hoá đơn, huỷ bên phải.
- **Tablet 768–1023px**: sidebar thu thành icon rail hoặc ẩn, nội dung 1 cột, aside chuyển xuống dưới.
- **Mobile <768px**:
  - App bar gọn: brand hoặc tên trang, theme/locale, icon Đăng xuất.
  - **Bottom tab bar** 4 mục: Nhóm, Thống kê, Thông báo, Hồ sơ. Trong trang nhóm có thêm nút nổi "+ Khoản chi".
  - Trang nhóm dùng **thanh chip anchor sticky** (Chi tiêu · Thành viên · Quản lý), cuộn tới section tương ứng. **Không dùng Tabs unmount**: xem §5.
  - Vùng chạm tối thiểu 44px.

## 4. Tiến độ

### Phase 0 — Chuẩn bị ✅

- [x] Tạo branch `feat/ui-redesign`.
- [x] Xoá UI legacy không còn route nào dùng: `src/app/{NewTripDialog,NewTripForm,RecentTrips}.tsx`, `page.module.css`, `src/app/trips/actions.ts`, `src/app/trips/[publicId]/*` (đã **giữ** các redirect `page.tsx` và `expenses/[expenseId]/edit/page.tsx`), `src/lib/recent-trips.ts`, `components/{Avatar,Modal,ConfirmSubmitForm,Select,FormError}.tsx`. Sau khi xoá, `tsc --noEmit` sạch.
- [x] Dùng screenshot của E2E (`statistics.png`, `notifications.png`, `homepage.png`) trên desktop/mobile để kiểm tra bố cục. Không còn baseline trước redesign; không có ảnh đối chiếu trước/sau.
- Ghi chú: `src/lib/{trips,expenses,balance,ocr,db,storage}.ts` và `tests/e2e/` (suite cũ, không còn chạy vì Playwright `testDir` là `tests/e2e-office`) **chưa đụng tới**. Có thể dọn trong một PR riêng.

### Phase 1 — Nền tảng ✅

- [x] Cài: `tailwindcss @tailwindcss/postcss tw-animate-css` (dev), `next-themes next-intl lucide-react radix-ui class-variance-authority clsx tailwind-merge recharts`.
- [x] `postcss.config.mjs`.
- [x] `next.config.ts` bọc trong `createNextIntlPlugin("./src/i18n/request.ts")`.
- [x] `src/i18n/config.ts`: `LOCALES`, `DEFAULT_LOCALE="vi"`, `LOCALE_COOKIE`, `TIME_ZONE="Asia/Ho_Chi_Minh"`, `isLocale`, `resolveLocale`.
- [x] `src/i18n/request.ts`: đọc cookie, nạp `messages/${locale}.json`.
- [x] `src/i18n/actions.ts`: server action `setLocale(locale)` ghi cookie (1 năm, lax, secure khi chạy prod).
- [x] `src/app/globals.css` **mới** (token + base). CSS cũ từng đổi tên để tham khảo và đã xoá ở Phase 5.
- [x] Tạo `messages/vi.json` + `messages/en.json`. Các namespace nền tảng: metadata/common/theme/locale/nav/shell/public/errors/status; hai locale có cùng key.
- [x] `src/i18n/server-messages.ts`: `localizeServerMessage(message, locale)` + test `tests/server-messages.test.ts`. Từ điển EN lấy từ các chuỗi trong `src/lib/office-actions.ts` (bảng `translations` + các `success:`), `src/app/auth/actions.ts`, `src/lib/money-input.ts`, `src/app/api/_shared.ts`, các route trong `src/app/api/**`, `src/lib/office-ocr.ts`, và các lỗi ở client trong `ImageUpload.tsx`.
- [x] `src/app/layout.tsx`:
  - Đổi font (Be Vietnam Pro + Geist Mono).
  - `<html lang={locale} suppressHydrationWarning>`.
  - Bọc `ThemeProvider` (next-themes, qua client `Providers.tsx`) và `NextIntlClientProvider`.
  - `metadata` dùng `generateMetadata` + `getTranslations`.
- [x] Primitives trong `src/app/components/ui/`:
  - `cn.ts` (clsx + tailwind-merge).
  - `button.tsx` (cva: default/secondary/outline/ghost/soft/destructive; sm/default/lg/icon). Có `buttonVariants` để style `<Link>`.
  - `card.tsx`.
  - `field.tsx`: `Field` phải dùng `<label>` **bọc** input để `getByLabel` vẫn hoạt động; kèm `Input`, `NativeSelect`.
  - `badge.tsx` (StatusBadge).
  - `theme-toggle.tsx` (Radix DropdownMenu).
  - `locale-switcher.tsx` (gọi `setLocale`).
  - `empty-state.tsx`, `stat-tile.tsx`, `skeleton.tsx`.
- [x] Viết lại `SubmitButton`, `ActionForm` (dịch `state.error/success` qua `localizeServerMessage`), `CopyButton` (icon Copy → Check).

### Phase 2 — Khung ứng dụng ✅

- [x] `AppShell` + `AppNavigation`: sidebar (desktop), topbar, `MobileTabBar`, nút nổi. Giữ skip-link và landmark.
- [x] `PublicPage` (header/footer public, có theme/locale toggle).
- [x] `loading.tsx` (skeleton), `error.tsx`, `not-found.tsx`.

### Phase 3 — Từng trang (UI mới + đưa chuỗi sang i18n) ✅

- [x] `/` dashboard (`src/app/page.tsx`): lời chào, stat tiles, lưới nhóm, form tạo nhóm **inline**.
- [x] `/groups/[groupId]`.
- [x] `/groups/[groupId]/expenses/new`, `/expenses/[expenseId]/edit`, `ExpenseEditor`, `ReceiptScanner`, `ImageUpload`, `SavedImage`, `BankEditor`.
- [x] `/expenses/[expenseId]`: `eventLabels` chuyển sang i18n. Ngày giờ dùng `getFormatter().dateTime`.
- [x] `/statistics`: biểu đồ tháng bằng Recharts, bảng thành viên (trên mobile chuyển thành card).
- [x] `/notifications`, `/profile` (thêm card "Giao diện & ngôn ngữ"), `/invite/[token]`.
- [x] Public: `PublicHome`, `/login` + `AuthForm`, `/reset-password` + `PasswordForm`, `/privacy`, `/terms`. Privacy và terms viết thành component nội dung riêng cho từng locale (`content.vi.tsx` / `content.en.tsx`) thay vì nhét vào JSON.
- [x] `OfficeUI.tsx`: badge đã dùng `StatusBadge` + namespace `status`, bỏ `statusText` hard-code. `money()` giữ nguyên, vì tiền tệ vẫn format theo locale của chính tiền tệ đó (`CURRENCY_META`).

### Phase 4 — Chuỗi phía server ✅

Đã nối `localizeServerMessage` vào `ActionForm`, `AuthForm`, `PasswordForm`,
`ExpenseEditor` (cả amount/custom validation), `ReceiptScanner`, `ImageUpload`
và `SavedImage`. Bao phủ lỗi/success server, upload, OCR và regex có tham số.
Thông báo mới/chưa biết được giữ nguyên, không làm mất chi tiết lỗi. Chuỗi nhãn
và hướng dẫn tĩnh đã chuyển sang namespace riêng ở Phase 3. Title notification
lưu trong DB cũng được map qua gettext; nội dung do người dùng nhập giữ nguyên.

### Phase 5 — Dọn dẹp và kiểm thử ✅

- [x] Xoá `globals.legacy.css`, `OfficeIcon.tsx`, các class CSS cũ còn sót.
- [x] Cập nhật script `format:check` trong `package.json`: thêm `src/i18n`, `src/app/components/ui`, `messages`, và bỏ các path đã xoá. Chạy prettier.
- [x] Unit test: `resolveLocale`, `localizeServerMessage`, và kiểm tra **hai file `messages/*.json` có cùng tập key**.
- [x] E2E: thêm test đổi ngôn ngữ sang EN, test đổi theme (class `dark` trên `<html>`), và test bottom nav hiển thị ở project `mobile`.
- [x] Chạy `npm run lint && npm run typecheck && npm test && npm run build`, sau đó `npm run e2e` (cần `npm run db:start` + `npm run e2e:prepare`).
- [x] Kiểm tra a11y bằng axe-core: public vi/en × light/dark; các trang app cả hai theme trên desktop/mobile, skip-link và menu bằng bàn phím. Lighthouse mobile DevTools đạt LCP < 2.5s, CLS < 0.1, JS < 300,000 bytes gzip; số mô phỏng Lantern đối chiếu ở §8.
- [x] Cập nhật `README.md` / `specs/02-plan.md` (tech stack: Tailwind, next-intl, next-themes).

## 5. Ràng buộc từ E2E (`tests/e2e-office/*`). Không được phá

Các selector dùng tiếng Việt và `exact: true`. Playwright chạy 2 project, **desktop** và **mobile (iPhone 13)**, và mặc định bật strict mode, nên mỗi selector chỉ được khớp đúng **một** phần tử đang hiển thị.

- Login: label `Email`, `Mật khẩu`, nút `Đăng nhập` (test dùng `.last()`). Sau khi đăng nhập phải về `/`.
- Dashboard: label `Tên nhóm` và nút `Tạo nhóm` phải **hiển thị sẵn**, không nằm trong dialog/drawer. Tạo xong redirect sang `/groups/{id}` với heading là tên nhóm.
- Mỗi link nhóm trên dashboard chỉ có **một** link chứa tên nhóm, nên không lặp lại danh sách nhóm ở sidebar.
- Tên nhóm chỉ được xuất hiện trong **một heading**. Tiêu đề trên topbar mobile phải dùng `<span>`, không dùng heading, vì `getByRole("heading", {name})` khớp theo chuỗi con.
- Invite: nút `Xin tham gia nhóm`; text `Bạn sẽ xem được dữ liệu nhóm sau khi quản trị viên duyệt.`
- Not found: heading `Không tìm thấy nội dung`.
- Group (owner): nút `Duyệt` và text `Yêu cầu tham gia (0)` phải được render và nhìn thấy được ở cả mobile, nên **không giấu trong tab bị unmount**.
- Profile: label `Ngân hàng`, `Số tài khoản`, `Tên chủ tài khoản`, `Nội dung chuyển khoản mặc định`. Phần tử `input[type="file"]` **cuối cùng** trên trang phải là input chọn ảnh QR. Text `Ảnh đã tải xong.`, nút `Lưu ngân hàng`, text `Đã lưu tài khoản ngân hàng.`
- Tạo expense:
  - Nút `Chụp / quét hóa đơn`, rồi `Chụp hóa đơn`. Phải có `input[capture="environment"]` với accept chứa `image`. Nút `Quét hóa đơn`.
  - Label `Tổng tiền (VND)` / `Tổng tiền (USD)`, `Mô tả`. `Cách chia` phải là **native `<select>`** (test gọi `selectOption("custom")`). Label `Phần của {tên}`.
  - `data-testid="expense-amount-preview"` có text `Số tiền sẽ lưu: 120.000 ₫`.
  - Ô tiền phải giữ `type="text"`. Nút `Tạo expense`.
- Expense: heading là mô tả. Text số tài khoản. Nút `Tôi đã chuyển tiền`, `Xác nhận đã nhận`. Badge exact `Chờ xác nhận`, `Hoàn tất`, `Đã hủy`. Text `1/1 người cần chuyển đã xác nhận`.
- Huỷ expense: phần tử đầu tiên có text exact `Hủy expense` (đang là `<summary>`) được click để mở ra, sau đó điền label `Lý do hủy`, rồi bấm nút `Hủy expense`.
- Statistics: text exact `Tổng chi`; text exact `101.000 ₫` (`.first()`).
- Notifications: chỉ có **một** heading chứa chữ `Thông báo`; nút `Đánh dấu tất cả đã đọc`. **Không được tràn ngang** (`scrollWidth <= innerWidth`) ở mobile.
- Đăng xuất: nút `Đăng xuất` chỉ hiển thị **đúng một** tại một thời điểm (ẩn bản còn lại bằng `hidden`/`lg:hidden`) và phải nhìn thấy được ở trang nhóm, trên cả desktop lẫn mobile, không nằm trong dropdown.
- Public `/`: heading exact `Chia tiền văn phòng`; link `Quyền riêng tư`, `Điều khoản` (mỗi link chỉ một bản hiển thị). Trang privacy có heading `Chính sách quyền riêng tư`, `Dịch vụ xử lý dữ liệu`; trang terms có `Điều khoản sử dụng`, `Thanh toán và xác nhận`. Không được tràn ngang.
- `/login` khi chưa cấu hình Supabase: heading `Cấu hình ứng dụng`, text exact `.env.example`.

## 6. Những điểm cần giữ khi bảo trì

- `ExpenseEditor` giữ input tiền dạng text, tính bằng `big.js`, native select và label
  tiếng Việt mặc định đúng selector E2E. Không cộng số dư khác tiền tệ.
- Chip nhóm là anchor: mọi section vẫn mount. Form tạo nhóm vẫn inline.
- Chuỗi tiếng Việt còn trong `ImageUpload`, `ReceiptScanner`, `SavedImage` là khoá
  gettext cho lỗi/trạng thái, có unit test bao phủ; nội dung `content.vi.tsx` là
  policy tiếng Việt. Đây không phải nội dung UI bỏ sót.
- Recharts và menu Radix theme tải riêng. Root chỉ gửi các namespace được client
  dùng; namespace page server vẫn có đầy đủ trong `getTranslations`.
- Be Vietnam Pro 400/700 được gộp subset để giảm số request. `font-display: optional`
  giữ fallback ổn định trên lần tải đầu chậm; font cache dùng cho lần sau. Chi tiết
  nguồn và giấy phép ở `src/app/fonts/README.md`.
- LCP phụ thuộc profile đo. DevTools mobile đạt ngưỡng; Lantern mặc định còn
  **2.67–2.97s**, vượt 2.5s. Không coi kết quả hai profile là tương đương.
- Camera/HEIC trên Safari iPhone và Android thật vẫn thuộc kiểm tra trước phát hành
  được ghi trong README; E2E mobile dùng Chromium với viewport iPhone 13.

## 7. Chạy lại kiểm chứng

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
npm run db:start
npm run e2e:prepare
npm run e2e
npm run ui:audit
```

`ui:audit` build production với Supabase local, tạo fixture riêng rồi dọn, đo
Lighthouse **mobile DevTools Slow 4G / CPU 4×**, cache trống mỗi trang. Lệnh trả
lỗi khi vượt ngưỡng LCP/CLS/JS hoặc accessibility dưới 100. Báo cáo HTML/JSON và
ảnh desktop/mobile/light/dark ở `artifacts/ui-audit/devtools/` (gitignore).

`npm run ui:audit:simulate` chạy mô phỏng Lantern cùng ngưỡng, xuất vào
`artifacts/ui-audit/simulate/`. Hiện profile này trả lỗi vì LCP cao hơn mục tiêu.
Benchmark local dùng fixture nhỏ, không phải số đo của site production.

Không còn phần UI trong các phase cần migrate. Thư viện/tests prototype cũ ngoài
scope ở Phase 0 vẫn được giữ như lịch sử dự án. Merge vào `main` kích hoạt Vercel production;
trạng thái phát hành thực tế được xác nhận qua GitHub deployment.

## 8. Kiểm chứng cuối (2026-10-06)

- Lint, typecheck, format và production build: qua.
- Unit/integration: **18 file, 151 test qua**. Catalog cùng key và cùng tham số ICU;
  gettext bao phủ cả chuỗi API/server lẫn trạng thái upload/OCR/ảnh ở client.
- E2E đầy đủ: **26 qua, 2 skip** (hai trường hợp chưa cấu hình Supabase được chạy riêng). Có kiểm tra locale/theme, bàn phím, vi/en, anchor mobile, input tiền, OCR mock và luồng Supabase thật.
- E2E cấu hình trống: **6/6 qua**, bao gồm hai bài setup skip trong lượt đầy đủ.
- Đã kiểm tra ảnh dashboard, statistics, public trên desktop/mobile/light/dark;
  chart screenshot đợi lazy chunk tải xong. Không còn tràn ngang trong các trang audit.
- Sau chỉnh token input: 8/8 bài accessibility public vi/en × light/dark trên desktop/mobile qua. Viền input tương phản với nền khoảng **3.24:1 light / 3.48:1 dark**.
- Sau chỉnh vùng bấm: 2/2 bài luồng English desktop/mobile qua; thêm kiểm tra dashboard 320px không tràn ngang, brand/link policy tối thiểu 44×44px, locale và đăng xuất vẫn hiển thị, cả hai theme qua axe.
- Không còn `OfficeIcon.tsx`, `globals.legacy.css` hay selector CSS legacy trong JSX.

Số Lighthouse trong [04-ui-audit.json](04-ui-audit.json), cache trống, bản production
và fixture Supabase local. JS là gzip tổng các chunk độc lập **được tải ở trang**,
bao gồm Recharts ở thống kê; menu theme tải khi người dùng mở.

| Trang      | LCP DevTools | CLS | JS gzip  | Performance | Accessibility | LCP Lantern |
| ---------- | ------------ | --- | -------- | ----------- | ------------- | ----------- |
| public     | 1.722s       | 0   | 182.0 KB | 99          | 100           | 2.834s      |
| dashboard  | 1.663s       | 0   | 182.0 KB | 89          | 100           | 2.671s      |
| statistics | 1.589s       | 0   | 284.3 KB | 96          | 100           | 2.972s      |

Lantern là lượt đối chiếu trước các chỉnh sửa cuối về viền input và vùng bấm;
DevTools là lượt đo bản cuối. Thời điểm từng lượt được giữ trong JSON.

## 9. Tính năng bổ sung sau redesign (2026-10-06)

- Xóa nhóm: chỉ chủ nhóm được thực hiện, phải nhập đúng tên nhóm để xác nhận.
  Xóa lịch sử chi phí, thanh toán và thành viên của nhóm; ảnh hóa đơn được đánh
  dấu để cron dọn sau thời gian chờ, không còn quyền xem ngay sau khi xóa.
- Rời nhóm: thành viên phải đối soát xong cả khoản phải trả và khoản phải thu.
  Khoản đã báo chuyển tiền vẫn phải được người nhận xác nhận. Chủ nhóm không
  được rời nhóm; lịch sử chi phí và tên người đã rời được giữ lại.
- Thống kê: mỗi loại tiền có lựa chọn biểu đồ theo tháng hoặc ngày, cùng bảng
  số tiền chính xác; mặc định theo tháng.
- Kiểm chứng: 18 file, 155 unit/integration test qua; 26 E2E hồi quy qua,
  2 skip, và 2 E2E tính năng mới trên desktop/mobile qua. Lint, format,
  typecheck và production build qua. Các số Lighthouse ở mục 8 là baseline
  của bản redesign, chưa đo lại cho phần bổ sung này.
- Đã áp dụng hai migration `202610060001_delete_group.sql` và
  `202610060002_leave_group.sql` lên Supabase production ngày 2026-10-06.
  Code được phát hành qua PR vào `main`; xem [hướng dẫn triển khai](../docs/deployment.md).
- Thử OCR với hóa đơn thật đã hoàn tất; kết quả và giới hạn được ghi ở
  [05-ocr-receipt-experiment.md](05-ocr-receipt-experiment.md).
