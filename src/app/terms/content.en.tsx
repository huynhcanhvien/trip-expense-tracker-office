import { supportEmail } from "../components/PublicPage";
export default function TermsContent({ updated }: { updated: string }) {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border bg-surface p-6 shadow-soft sm:p-10 [&_h2]:mt-8 [&_p]:mt-4 [&_p]:leading-8 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
      <h1>Terms of use</h1>
      <p className="text-sm text-muted-foreground">{updated}</p>
      <p>
        By using Office Split, you agree to use the app to record expenses and
        reconcile repayments with the people involved.
      </p>
      <h2>Accounts and content</h2>
      <p>
        Protect your sign-in details and only enter data you have permission to
        use. You are responsible for the accuracy of expenses, shares, bank
        details and uploaded images. Do not use the app for impersonation,
        fraud, unauthorized data access or service disruption.
      </p>
      <h2>Payments and confirmation</h2>
      <p>
        The app does not hold money or make transfers. Transfer through your
        banking service and check the recipient and amount before sending.
        Reporting a transfer is a member&apos;s notification; the person who
        paid must check the actual transaction before confirming receipt. The
        people involved must resolve incorrect transfers or disputes themselves.
      </p>
      <h2>Images and scan results</h2>
      <p>
        Receipt scanning is an aid and may read information incorrectly. Check
        the amount, date, description and participants before saving. OCR
        results and statistics are not bank documents or accounting advice.
      </p>
      <h2>Data and service</h2>
      <p>
        Data processing is described in the privacy policy. Features may change
        or become temporarily unavailable due to maintenance or provider
        services. The operator may restrict accounts that violate these terms or
        affect others. Keep the records you need for independent reconciliation.
      </p>
      <h2>Support and changes</h2>
      <p>
        Contact <a href={`mailto:${supportEmail}`}>{supportEmail}</a> to report
        problems, request support or discuss your data. These terms may be
        updated. The current version and its update date are published on this
        page.
      </p>
    </article>
  );
}
