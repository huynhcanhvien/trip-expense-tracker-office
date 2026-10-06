import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import AppShell from "./components/AppShell";
import ActionForm from "./components/ActionForm";
import { Empty, Heading, money } from "./components/OfficeUI";
import { Card, CardHeader } from "./components/ui/card";
import { Field, Input, NativeSelect } from "./components/ui/field";
import { GroupAvatar } from "./components/ui/group-avatar";
import { StatTile } from "./components/ui/stat-tile";
import {
  groupsForUser,
  officeContext,
  checked,
  unreadNotifications,
} from "@/lib/office-data";
import { currentBalances } from "@/lib/office-dashboard";
import { createGroup } from "@/lib/office-actions";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { authenticatedContext } from "@/lib/supabase/server";
import { connection } from "next/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import PublicHome from "./components/PublicHome";
export default async function Home() {
  await connection();
  if (!supabaseConfigured()) return <PublicHome />;
  const { user: visitor } = await authenticatedContext();
  if (!visitor) return <PublicHome />;
  const t = await getTranslations("dashboard");
  const { supabase, user } = await officeContext();
  const [groups, profile, count, balances] = await Promise.all([
    groupsForUser(),
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    unreadNotifications(),
    currentBalances(),
  ]);
  const name = checked(profile)?.name || user.email?.split("@")[0] || t("you");
  return (
    <AppShell>
      <Heading
        eyebrow={t("yourSharedLedger")}
        title={t("greeting", { name })}
        description={t("trackExpensesYouPaidSplitCosts")}
      />
      <section
        className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-hover p-6 text-primary-foreground shadow-lift sm:p-8"
        aria-labelledby="balance-title"
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-xl bg-primary-foreground/10 p-3">
            <Wallet size={26} />
          </span>
          <div>
            <h2 id="balance-title">{t("balanceTitle")}</h2>
            <p className="mt-1 text-sm leading-6">{t("balanceDescription")}</p>
          </div>
        </div>
        {balances.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {balances.map((b) => (
              <div
                key={b.currency}
                className="rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 p-4"
              >
                <span className="text-xs font-bold tracking-widest">
                  {b.currency}
                </span>
                <dl className="mt-3 space-y-3">
                  <div>
                    <dt className="text-xs">{t("toPay")}</dt>
                    <dd className="tabular mt-1 text-xl font-bold">
                      {money(b.toPay, b.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs">{t("toReceive")}</dt>
                    <dd className="tabular mt-1 text-xl font-bold">
                      {money(b.toReceive, b.currency)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm">{t("noBalances")}</p>
        )}
      </section>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          label={t("groupsJoined")}
          value={groups.length}
          icon={<Users />}
        />
        <StatTile
          label={t("groupsYouManage")}
          value={groups.filter((g) => g.owner_id === user.id).length}
          icon={<ShieldCheck />}
        />
        <Link href="/notifications">
          <StatTile
            label={t("unreadNotifications")}
            value={count}
            icon={<Bell />}
          />
        </Link>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader>
            <h2>{t("yourGroups")}</h2>
            <Link
              className="inline-flex min-h-11 items-center text-xs font-semibold text-primary"
              href="/notifications"
            >
              {t("unreadCount", { count })}
            </Link>
          </CardHeader>
          {groups.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((g) => (
                <Link
                  className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-surface-raised p-5 shadow-soft transition-colors hover:border-primary"
                  key={g.id}
                  href={`/groups/${g.id}`}
                >
                  <div className="flex items-center justify-between">
                    <GroupAvatar name={g.name} />
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">
                      {g.currency}
                    </span>
                  </div>
                  <strong className="text-base wrap-anywhere">{g.name}</strong>
                  <span className="mt-2 text-sm leading-7 text-muted-foreground">
                    {g.currency} ·{" "}
                    {g.owner_id === user.id ? t("youManage") : t("member")}
                  </span>
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3 text-xs font-medium text-primary">
                    {t("openGroup")}
                    <ArrowRight size={16} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>{t("youHaveNotJoinedAGroup")}</Empty>
          )}
        </Card>
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2">
              <Plus className="text-primary" size={22} />
              {t("createANewGroup")}
            </h2>
          </CardHeader>
          <p className="text-sm text-muted-foreground">
            {t("eachGroupUsesOneFixedCurrency")}
          </p>
          <ActionForm action={createGroup} label={t("createGroup")}>
            <Field label={t("groupName")}>
              <Input
                name="name"
                placeholder={t("forExampleMarketingLunch")}
                required
                maxLength={100}
              />
            </Field>
            <Field label={t("currency")}>
              <NativeSelect name="currency" defaultValue="VND">
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </Field>
          </ActionForm>
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-primary-soft p-3 text-xs leading-6 text-primary-soft-foreground">
            <ShieldCheck className="mt-1 shrink-0" size={16} />
            {t("onlyApprovedMembersCanSeeYour")}
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
