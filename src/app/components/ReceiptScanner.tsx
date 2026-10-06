"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { localizeServerMessage } from "@/i18n/server-messages";
import { useEffect, useRef, useState } from "react";
import ImageUpload, { type UploadedImage } from "./ImageUpload";

type ScannedReceipt = {
  uploadId: string;
  amount: string | null;
  description: string | null;
  expenseDate: string | null;
};
type Props = {
  groupId: string;
  onScanned: (receipt: ScannedReceipt) => void;
  onBusyChange?: (busy: boolean) => void;
};

export default function ReceiptScanner({
  groupId,
  onScanned,
  onBusyChange,
}: Props) {
  const t = useTranslations("scanner");
  const locale = useLocale();
  const [upload, setUpload] = useState<UploadedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [message, setMessage] = useState("");
  const sequence = useRef(0);
  useEffect(() => {
    onBusyChange?.(busy || uploadBusy);
  }, [busy, uploadBusy, onBusyChange]);

  function uploaded(image: UploadedImage) {
    sequence.current++;
    setUpload(image);
    setMessage("");
    setBusy(false);
    onScanned({
      uploadId: image.id,
      amount: null,
      description: null,
      expenseDate: null,
    });
  }

  async function scan() {
    if (!upload || busy || uploadBusy) return;
    const current = ++sequence.current;
    setBusy(true);
    setMessage("Đang đọc hóa đơn…");
    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: upload.id }),
        signal: AbortSignal.timeout(55_000),
      });
      const data = await response.json();
      if (current !== sequence.current) return;
      if (!response.ok)
        throw new Error(data.error || "Không quét được hóa đơn.");
      if (!data.readable || !data.amount) {
        setMessage(
          "Không đọc rõ tổng tiền. Bạn có thể đổi ảnh hoặc nhập bằng tay.",
        );
        return;
      }
      onScanned({
        uploadId: data.uploadId,
        amount: data.amount,
        description: data.description,
        expenseDate: data.expenseDate,
      });
      setMessage(
        "Đã điền kết quả quét. Hãy kiểm tra số tiền, ngày và người chia trước khi lưu.",
      );
    } catch (error) {
      if (current === sequence.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Không quét được hóa đơn. Bạn có thể nhập tay.",
        );
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }

  return (
    <section
      className="my-5 space-y-4 rounded-2xl border border-dashed bg-muted/30 p-4"
      aria-label={t("scanReceipt")}
    >
      <ImageUpload
        groupId={groupId}
        kind="receipt"
        onUploaded={uploaded}
        onBusyChange={setUploadBusy}
      />
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {t("whenYouScanTheReceiptImage")}
      </p>
      {upload && (
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-input bg-surface-raised text-foreground hover:bg-muted"
          disabled={busy || uploadBusy}
          onClick={() => void scan()}
        >
          {busy ? t("scanning") : t("scanReceipt")}
        </button>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {localizeServerMessage(message, locale)}
        </p>
      )}
    </section>
  );
}
