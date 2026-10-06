"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import ImageUpload from "./ImageUpload";
import SavedImage from "./SavedImage";
import ActionForm from "./ActionForm";
import { saveBank } from "@/lib/office-actions";
import type { BankAccount } from "@/lib/office-types";
export default function BankEditor({ bank }: { bank: BankAccount | null }) {
  const t = useTranslations("bank");
  const [qr, setQr] = useState(bank?.qr_upload_id || "");
  const [uploadBusy, setUploadBusy] = useState(false);
  return (
    <>
      <ActionForm
        action={saveBank}
        label={t("saveBankAccount")}
        submitDisabled={uploadBusy}
      >
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("bank")}
          <input
            name="bankName"
            defaultValue={bank?.bank_name || ""}
            required
            maxLength={100}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("accountNumber")}
          <input
            name="accountNumber"
            inputMode="numeric"
            defaultValue={bank?.account_number || ""}
            required
            maxLength={50}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("accountHolderName")}
          <input
            name="accountHolder"
            defaultValue={bank?.account_holder || ""}
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
            onUploaded={(v) => setQr(v.id)}
          />
        </div>
      </ActionForm>
    </>
  );
}
