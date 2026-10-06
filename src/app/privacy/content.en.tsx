import { supportEmail } from "../components/PublicPage";
export default function PrivacyContent({ updated }: { updated: string }) {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border bg-surface p-6 shadow-soft sm:p-10 [&_h2]:mt-8 [&_p]:mt-4 [&_p]:leading-8 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
      <h1>Privacy policy</h1>
      <p className="text-sm text-muted-foreground">{updated}</p>
      <p>
        Office Split records group expenses and tracks repayments. It is managed
        by the operator reachable at{" "}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
      </p>
      <h2>Data we use</h2>
      <p>
        The app stores your email address, account ID and display name; groups
        and members; expenses, shares, payment status and confirmation history.
        If you provide them, it also stores bank account details, transfer
        references, QR codes and receipt images.
      </p>
      <p>
        When you sign in with Google, Supabase processes basic identity
        information such as your account ID, email address and Google profile.
        The app uses this to sign you in and identify members. It does not
        request access to Gmail, Google Drive or contacts.
      </p>
      <h2>Purpose and access</h2>
      <p>
        Data is used for sign-in, group management, cost sharing, repayment
        confirmation, statistics and support. Approved members can see group
        data according to their permissions. People with access to an expense
        can see the payer&apos;s transfer details. Do not upload information you
        do not want to share with authorized people in your group.
      </p>
      <h2>Data processing services</h2>
      <p>
        Vercel serves the website and API. Supabase stores accounts, database
        records and images. The SMTP service configured by the operator sends
        verification and recovery emails. These services may process technical
        information, such as IP addresses and operational logs, according to
        their configuration and policies.
      </p>
      <p>
        Only when you choose to scan a receipt is the image used for scanning
        sent to Groq to extract information. You can enter expenses manually
        instead. Do not submit receipts containing unnecessary information or
        sensitive data you do not want the service to process.
      </p>
      <p>
        The operator does not sell Google data or use it for advertising. Data
        is shared with service providers to perform the functions described
        above and when necessary to comply with legal requirements.
      </p>
      <h2>Storage and protection</h2>
      <p>
        The app uses cookies to maintain sign-in sessions and store your
        language preference; appearance preferences are stored in your browser.
        Images are stored in a private bucket. Access is checked and image links
        expire. The operator has administrative access to operate and support
        the service.
      </p>
      <p>
        Group and expense data is retained for reconciliation until the operator
        processes an appropriate deletion request. Cancelling an expense
        preserves payment history and does not automatically delete data.
        Unattached images enter a cleanup process after 24 hours, depending on
        its schedule and service status. Backups and logs may remain according
        to provider configuration.
      </p>
      <h2>Access, correction and deletion requests</h2>
      <p>
        You can edit your profile in the app and request access to, export of,
        or deletion of your data by contacting{" "}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. The operator will
        verify account ownership and discuss the scope, including shared records
        that need to be retained for reconciliation. The app currently has no
        self-service account deletion button.
      </p>
      <p>
        You can revoke Google access through the third-party application
        connections in your Google account. This does not automatically delete
        data already stored in the app.
      </p>
      <h2>Changes and contact</h2>
      <p>
        This policy may be updated when features or providers change. The update
        date appears on this page. Contact:{" "}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
      </p>
    </article>
  );
}
