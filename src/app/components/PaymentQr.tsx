/* eslint-disable @next/next/no-img-element -- Inline SVG data URL generated on the server; nothing to optimize. */
import QRCode from "qrcode";

/** Server-rendered VietQR; rendered as an <img> so no markup is injected. */
export default async function PaymentQr({
  payload,
  label,
  size = 224,
}: {
  payload: string;
  label: string;
  size?: number;
}) {
  const svg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return (
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt={label}
      width={size}
      height={size}
      className="mx-auto rounded-xl border bg-white p-1"
    />
  );
}
