import {
  ArrowRight,
  Camera,
  ChartColumn,
  Check,
  Landmark,
  Receipt,
  ShieldCheck,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import PublicPage from "./PublicPage";

export default async function PublicHome() {
  const t = await getTranslations("landing");
  const features: { icon: LucideIcon; title: string; description: string }[] = [
    {
      icon: Users,
      title: t("oneGroupSharedCosts"),
      description: t("createAGroupSendAnInvitation"),
    },
    {
      icon: Camera,
      title: t("captureAPhotoTypeLess"),
      description: t("captureAReceiptOnYourPhone"),
    },
    {
      icon: Landmark,
      title: t("easyRepayments"),
      description: t("addYourAccountNumberTransferReference"),
    },
    {
      icon: ChartColumn,
      title: t("understandEveryExpense"),
      description: t("seeTotalSpendingConfirmedReceiptsAnd"),
    },
  ];

  return (
    <PublicPage>
      <div>
        <section className="grid items-center gap-10 rounded-2xl border bg-surface p-6 shadow-soft sm:p-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-2 text-xs text-accent-soft-foreground">
              <span className="size-1.5 rounded-full bg-current" />
              {t("forEverydayExpensesWithColleagues")}
            </p>
            <h1 className="text-4xl sm:text-5xl">{t("officeSplit")}</h1>
            <p className="mt-5 text-2xl font-semibold leading-relaxed">
              {t("sharedCostsMadeEasy")}
              <br />
              <span className="text-primary">{t("clearDownToEachPerson")}</span>
            </p>
            <p className="mt-5 max-w-xl text-sm leading-8 text-muted-foreground">
              {t("fromLunchToCoffeeRecordWhat")}
            </p>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover mt-6"
              href="/login"
            >
              {t("signInOrCreateAnAccount")}
              <ArrowRight size={19} />
            </Link>
            <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} />
                {t("privateWithinYourGroup")}
              </span>
              <span className="flex items-center gap-2">
                <Smartphone size={16} />
                {t("useDirectlyOnTheWeb")}
              </span>
            </div>
          </div>
          <div
            className="mx-auto w-full max-w-sm"
            aria-label={t("exampleOfSplittingAnExpense")}
          >
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-widest text-muted-foreground">
              <span className="size-2 rounded-full bg-success" />
              {t("previewLabel")}
            </div>
            <div className="rounded-2xl border bg-surface-raised p-6 shadow-lift">
              <div className="mb-5 flex items-center justify-between">
                <span className="rounded-xl bg-primary-soft p-3 text-primary-soft-foreground">
                  <Receipt size={25} />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-success-soft text-success">
                  <Check size={12} />
                  {t("completed")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("lunchWithTheTeam")}
              </p>
              <strong className="mt-2 block text-4xl font-bold tabular-nums">
                360.000 <span className="text-2xl">₫</span>
              </strong>
              <div className="my-5 border-t" />
              <div className="mb-4 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{t("splitEquallyBetween3People")}</span>
                <span>{t("demoShare")}</span>
              </div>
              {[
                {
                  name: t("you"),
                  initial: "B",
                  status: t("paidUpfront"),
                  color: "bg-muted text-foreground",
                },
                {
                  name: "Minh",
                  initial: "M",
                  status: t("confirmed"),
                  color: "bg-accent-soft text-accent-soft-foreground",
                },
                {
                  name: "Linh",
                  initial: "L",
                  status: t("confirmed"),
                  color: "bg-primary-soft text-primary-soft-foreground",
                },
              ].map((person) => (
                <div
                  className="flex items-center gap-3 border-b py-3 text-xs"
                  key={person.name}
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent-soft-foreground ${person.color}`}
                  >
                    {person.initial}
                  </span>
                  <strong>{person.name}</strong>
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-success">
                    {person.status}
                    <Check size={14} />
                  </span>
                </div>
              ))}
              <div className="mt-5 flex gap-1">
                <span className="h-1.5 flex-1 rounded-full bg-success" />
                <span className="h-1.5 flex-1 rounded-full bg-success" />
                <span className="h-1.5 flex-1 rounded-full bg-success" />
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-success">
                <Check size={15} />
                {t("allRepaymentsHaveBeenConfirmed")}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-accent-soft p-4 text-accent-soft-foreground">
              <span>
                <Camera size={19} />
              </span>
              <div className="flex flex-col gap-1 text-xs">
                <strong>{t("fromReceiptPhotoToExpense")}</strong>
                <span className="text-[10px]">
                  {t("quickScanReviewSaveExpense")}
                </span>
              </div>
            </div>
          </div>
        </section>
        <section
          className="grid grid-cols-1 gap-5 py-10 sm:grid-cols-3"
          aria-label={t("howItWorks")}
        >
          <div className="space-y-2">
            <span className="mr-3 inline-flex size-8 items-center justify-center rounded-xl bg-primary-soft text-xs font-bold text-primary-soft-foreground">
              01
            </span>
            <strong>{t("createGroup")}</strong>
            <p className="text-sm text-muted-foreground">
              {t("inviteThePeopleSharingTheCost")}
            </p>
          </div>
          <ArrowRight />
          <div className="space-y-2">
            <span className="mr-3 inline-flex size-8 items-center justify-center rounded-xl bg-primary-soft text-xs font-bold text-primary-soft-foreground">
              02
            </span>
            <strong>{t("addExpense")}</strong>
            <p className="text-sm text-muted-foreground">
              {t("splitEquallyOrEnterIndividualShares")}
            </p>
          </div>
          <ArrowRight />
          <div className="space-y-2">
            <span className="mr-3 inline-flex size-8 items-center justify-center rounded-xl bg-primary-soft text-xs font-bold text-primary-soft-foreground">
              03
            </span>
            <strong>{t("confirmRepayments")}</strong>
            <p className="text-sm text-muted-foreground">
              {t("seeWhoHasTransferredAndWho")}
            </p>
          </div>
        </section>
        <section className="py-8" id="features">
          <div className="mb-7 space-y-3">
            <p className="mb-2 font-bold uppercase tracking-[0.15em] text-sm text-muted-foreground">
              {t("featureEyebrow")}
            </p>
            <h2 className="text-2xl">
              {t("fromReceiptToRepaymentConfirmation")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("everythingYouNeedForSharedCosts")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <article
                className="rounded-2xl border bg-surface p-6"
                key={feature.title}
              >
                <span className="mb-4 inline-flex rounded-xl bg-accent-soft p-3 text-accent-soft-foreground">
                  <feature.icon size={25} />
                </span>
                <h3>{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="my-8 flex gap-4 rounded-2xl bg-primary-soft p-6 text-primary-soft-foreground">
          <div className="shrink-0">
            <ShieldCheck size={30} />
          </div>
          <div>
            <h2>{t("signInAndYourData")}</h2>
            <p className="mt-3 text-sm leading-7">
              {t("signInWithGoogleOrEmail")}
            </p>
            <p className="mt-3 text-sm leading-7">
              {t("whenYouScanTheReceiptImage")}
            </p>
          </div>
        </section>
        <section className="flex flex-wrap items-center justify-between gap-6 py-8">
          <div>
            <h2 className="text-2xl">{t("readyToSplitYourNextExpense")}</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("createYourGroupAndStartWith")}
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            href="/login"
          >
            {t("getStarted")}
            <ArrowRight size={18} />
          </Link>
        </section>
      </div>
    </PublicPage>
  );
}
