/** Must match the interval in `public.auto_confirm_payments`. */
export const AUTO_CONFIRM_HOURS = 48;

/** When a reported transfer the payer has not answered gets confirmed automatically. */
export function autoConfirmAt(reportedAt: string): Date {
  return new Date(
    new Date(reportedAt).getTime() + AUTO_CONFIRM_HOURS * 3_600_000,
  );
}
