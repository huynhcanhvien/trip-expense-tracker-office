"use client";
/* eslint-disable @next/next/no-img-element -- Private signed URLs expire and must bypass public image optimization. */
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { localizeServerMessage } from "@/i18n/server-messages";
import { useEffect, useState } from "react";
export default function SavedImage({
  uploadId,
  alt,
  className,
}: {
  uploadId: string;
  alt: string;
  className?: string;
}) {
  const t = useTranslations("savedImage");
  const locale = useLocale();
  const [image, setImage] = useState<{
    id: string;
    url: string;
    error: string;
  }>({ id: "", url: "", error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/uploads/${encodeURIComponent(uploadId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Không đọc được ảnh.");
        if (active) setImage({ id: uploadId, url: result.url, error: "" });
      } catch (error) {
        if (active)
          setImage({
            id: uploadId,
            url: "",
            error:
              error instanceof Error ? error.message : "Không đọc được ảnh.",
          });
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [uploadId, retry]);
  const current =
    image.id === uploadId ? image : { id: uploadId, url: "", error: "" };
  if (current.error)
    return (
      <div>
        <p
          role="alert"
          className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
        >
          {localizeServerMessage(current.error, locale)}
        </p>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-input bg-surface-raised text-foreground hover:bg-muted"
          onClick={() => {
            setImage({ id: uploadId, url: "", error: "" });
            setRetry((n) => n + 1);
          }}
        >
          {t("reloadImage")}
        </button>
      </div>
    );
  if (!current.url)
    return (
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {t("loadingImage")}
      </p>
    );
  return (
    <img
      src={current.url}
      alt={alt}
      className={className}
      onError={() =>
        setImage({
          ...current,
          error: "Ảnh đã hết hạn hoặc không tải được. Vui lòng tải lại.",
        })
      }
      style={{
        maxWidth: "100%",
        maxHeight: 400,
        objectFit: "contain",
        borderRadius: 12,
      }}
    />
  );
}
