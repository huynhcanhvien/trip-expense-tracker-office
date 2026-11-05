// Demo data for trying the UI against local Supabase only. Everything goes
// through the real RPCs, so balances, RLS and payment batches behave as in prod.
// Usage: npm run db:start && npm run e2e:prepare && npm run db:seed
import { createClient } from "@supabase/supabase-js";

const ENV_FILE = process.argv[2] || ".env.test.local";
const PASSWORD = "demo-password-123";
const daysAgo = (days) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

process.loadEnvFile(ENV_FILE);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !anonKey || !secretKey)
  throw new Error(`${ENV_FILE} is missing local Supabase credentials.`);
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(url).hostname))
  throw new Error("Seeding is only allowed against local Supabase.");

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const PEOPLE = {
  me: { email: "me@demo.local", name: "Bạn Demo" },
  an: { email: "an@demo.local", name: "Nguyễn An" },
  binh: { email: "binh@demo.local", name: "Trần Bình" },
  chi: { email: "chi@demo.local", name: "Lê Chi" },
};

async function ensureUser({ email, name }) {
  const { data: list, error } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) throw error;
  if (list.users.some((u) => u.email === email))
    throw new Error(
      "Demo data already exists. Run `npx supabase db reset --local` (wipes local data) and seed again.",
    );
  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createError) throw createError;
  return data.user.id;
}

async function signIn(email) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw error;
  return async (name, args = {}) => {
    const { data, error: rpcError } = await client.rpc(name, args);
    if (rpcError) throw new Error(`${name}: ${rpcError.message}`);
    return data;
  };
}

const ids = {};
const as = {};
for (const [key, person] of Object.entries(PEOPLE)) {
  ids[key] = await ensureUser(person);
  as[key] = await signIn(person.email);
}

async function group(owner, name, currency, members) {
  const id = await as[owner]("create_group", {
    p_name: name,
    p_currency: currency,
  });
  const { data } = await admin
    .from("office_groups")
    .select("invite_token")
    .eq("id", id)
    .single();
  for (const member of members) {
    const request = await as[member]("request_join", {
      p_token: data.invite_token,
    });
    await as[owner]("decide_join", { p_request_id: request, p_approve: true });
  }
  return id;
}

// Days before today, so batches span several dates like real ones.
const AGE = {
  "Ăn trưa thứ Hai": 9,
  "Cà phê team": 6,
  "Thuê xe máy": 2,
  "Homestay 2 đêm": 4,
  "Lẩu gà lá é": 3,
  "Quà sinh nhật chị Hoa": 1,
  "Văn phòng phẩm": 5,
  "Ramen Ichiran": 3,
  "Bánh mì sáng": 7,
  "Xăng xe": 2,
};
const expense = (payer, groupId, description, amount, people, category) =>
  as[payer]("save_expense", {
    p_expense_id: null,
    p_group_id: groupId,
    p_description: description,
    p_amount: amount,
    p_expense_date: daysAgo(AGE[description] ?? 0),
    p_split_mode: "even",
    p_shares: people.map((p) => ({ userId: ids[p] })),
    p_receipt_upload_id: null,
    p_payer_id: null,
    p_category: category,
  });

await as.an("save_bank_profile", {
  p_bank_name: "Vietcombank",
  p_account_number: "0123456789",
  p_account_holder: "NGUYEN AN",
  p_transfer_template: "",
  p_qr_upload_id: null,
  p_bank_bin: "970436",
});
await as.binh("save_bank_profile", {
  p_bank_name: "Techcombank",
  p_account_number: "19033334444",
  p_account_holder: "TRAN BINH",
  p_transfer_template: "",
  p_qr_upload_id: null,
  p_bank_bin: "970407",
});
await as.me("save_bank_profile", {
  p_bank_name: "MB Bank",
  p_account_number: "0987654321",
  p_account_holder: "BAN DEMO",
  p_transfer_template: "",
  p_qr_upload_id: null,
  p_bank_bin: "970422",
});
// Chi has no bank account, to show the card without a QR code.

const marketing = await group("an", "Phòng Marketing", "VND", [
  "me",
  "binh",
  "chi",
]);
const dalat = await group("binh", "Team trip Đà Lạt", "VND", ["me", "an"]);
const tokyo = await group("an", "Offsite Tokyo", "JPY", ["me", "chi"]);

// Owed to An in two groups: one VND QR covering both.
await expense(
  "an",
  marketing,
  "Ăn trưa thứ Hai",
  "480000",
  ["an", "me", "binh", "chi"],
  "food",
);
await expense(
  "an",
  marketing,
  "Cà phê team",
  "180000",
  ["an", "me", "binh"],
  "food",
);
await expense(
  "an",
  dalat,
  "Thuê xe máy",
  "300000",
  ["an", "me", "binh"],
  "transport",
);
// Owed to Bình; one of them already reported, so it shows as awaiting confirmation.
await expense(
  "binh",
  dalat,
  "Homestay 2 đêm",
  "2400000",
  ["binh", "me", "an"],
  "other",
);
await expense(
  "binh",
  dalat,
  "Lẩu gà lá é",
  "650000",
  ["binh", "me"],
  "food",
  3,
);
const reported = await expense(
  "binh",
  marketing,
  "Quà sinh nhật chị Hoa",
  "200000",
  ["binh", "me"],
  "gift",
);
await as.me("payment_action", {
  p_expense_id: reported,
  p_action: "report",
  p_user_id: ids.me,
});
// Owed to Chi, who has no bank account.
await expense(
  "chi",
  marketing,
  "Văn phòng phẩm",
  "120000",
  ["chi", "me"],
  "office",
);
// JPY cannot be paid by VietQR.
await expense(
  "an",
  tokyo,
  "Ramen Ichiran",
  "4500",
  ["an", "me", "chi"],
  "food",
);
// Others owe "me": Bình reports one batch so "me" receives a batch notification.
await expense(
  "me",
  marketing,
  "Bánh mì sáng",
  "150000",
  ["me", "binh", "an"],
  "food",
);
await expense("me", dalat, "Xăng xe", "200000", ["me", "binh"], "transport");
const [batch] = (await as.binh("open_payment_batches")).filter(
  (b) => b.receiver_id === ids.me,
);
await as.binh("report_payment_batch", { p_batch_id: batch.batch_id });

console.log(`Seeded demo data. Sign in at http://localhost:3000/login with:
  ${PEOPLE.me.email} / ${PASSWORD}   (owes An, Bình, Chi; open /pay)
  ${PEOPLE.binh.email} / ${PASSWORD}
Transfer TT ${batch.code} from Bình to you is at /pay/${batch.code}.`);
