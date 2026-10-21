"use client";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import ImageUpload from "./ImageUpload";
import SavedImage from "./SavedImage";
import ActionForm from "./ActionForm";
import { saveBank } from "@/lib/office-actions";
import type { BankAccount } from "@/lib/office-types";
import { bankByBin, bankByName, VIETQR_BANKS } from "@/lib/vietqr-banks";
import { decodeVietQrImage } from "@/lib/qr-decode";
type QrNotice = "" | "filled" | "unknownBank" | "notFound";
export default function BankEditor({ bank }: { bank: BankAccount | null }) {
  const t = useTranslations("bank");
  const [qr, setQr] = useState(bank?.qr_upload_id || "");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [bankName, setBankName] = useState(bank?.bank_name || "");
  const [bankBin, setBankBin] = useState(
    bank?.bank_bin || bankByName(bank?.bank_name || "")?.bin || "",
  );
  const [accountNumber, setAccountNumber] = useState(
    bank?.account_number || "",
  );
  const [accountHolder, setAccountHolder] = useState(
    bank?.account_holder || "",
  );
  const [qrNotice, setQrNotice] = useState<QrNotice>("");
  const changeBankName = (value: string) => {
    setBankName(value);
    const match = bankByName(value);
    // A BIN read from a QR for a bank missing from our list survives renaming.
    setBankBin((bin) => (match ? match.bin : bankByBin(bin) ? "" : bin));
  };
  const readQr = useCallback(async (image: Blob) => {
    setQrNotice("");
    const account = await decodeVietQrImage(image).catch(() => null);
    if (!account) return setQrNotice("notFound");
    const known = bankByBin(account.bin);
    setBankBin(account.bin);
    if (known) setBankName(known.shortName);
    setAccountNumber(account.accountNumber);
    if (account.holderName) setAccountHolder(account.holderName);
    setQrNotice(known ? "filled" : "unknownBank");
  }, []);
  return (
    <>
      <ActionForm
        action={saveBank}
        label={t("saveBankAccount")}
        submitDisabled={uploadBusy}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
            {t("bank")}
            <input
              name="bankName"
              list="vietqr-banks"
              autoComplete="off"
              aria-describedby="bank-vietqr-hint"
              value={bankName}
              onChange={(event) => changeBankName(event.target.value)}
              required
              maxLength={100}
            />
          </label>
          <datalist id="vietqr-banks">
            {VIETQR_BANKS.map((option) => (
              <option key={option.bin} value={option.shortName}>
                {option.name}
              </option>
            ))}
          </datalist>
          <p id="bank-vietqr-hint" className="text-xs text-muted-foreground">
            {bankBin ? t("vietQrReady") : t("vietQrPickBank")}
          </p>
        </div>
        <input type="hidden" name="bankBin" value={bankBin} />
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("accountNumber")}
          <input
            name="accountNumber"
            inputMode="numeric"
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
            required
            maxLength={50}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("accountHolderName")}
          <input
            name="accountHolder"
            value={accountHolder}
            onChange={(event) => setAccountHolder(event.target.value)}
            required
            maxLength={150}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("defaultTransferReference")}
          <input
            name="transferTemplate"
            defaultValue={bank?.transfer_template || ""}
            placeholder={t("forExampleNguyenVanARepayment")}
            maxLength={200}
          />
        </label>
        <input type="hidden" name="qrUploadId" value={qr} />
        <div className="mt-3 space-y-4 border-t pt-5">
          <h3>{t("bankQRCode")}</h3>
          {qr && (
            <>
              <SavedImage
                className="mx-auto mt-5 max-h-72 rounded-xl"
                uploadId={qr}
                alt={t("yourBankQRCode")}
              />
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-input bg-surface-raised text-foreground hover:bg-muted"
                disabled={uploadBusy}
                onClick={() => setQr("")}
              >
                {t("removeQR")}
              </button>
            </>
          )}
          <ImageUpload
            kind="qr"
            onBusyChange={setUploadBusy}
            onPrepared={readQr}
            onUploaded={(v) => setQr(v.id)}
          />
          {qrNotice && (
            <p
              aria-live="polite"
              className={
                qrNotice === "filled"
                  ? "rounded-xl bg-success-soft p-3 text-sm leading-6 text-success"
                  : "rounded-xl bg-muted p-3 text-sm leading-6 text-muted-foreground"
              }
            >
              {t(`qrNotice.${qrNotice}`)}
            </p>
          )}
        </div>
      </ActionForm>
    </>
  );
}
