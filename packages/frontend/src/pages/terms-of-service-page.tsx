import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const effectiveDate = "February 15, 2026";

export const TermsOfServicePage = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>Effective date: {effectiveDate}</p>
          <div className="flex items-center gap-3">
            <Link className="underline underline-offset-4" to="/privacy">
              Privacy Policy
            </Link>
            <Link className="underline underline-offset-4" to="/">
              Dashboard
            </Link>
          </div>
        </div>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-2xl">Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-muted-foreground">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                1. Acceptance
              </h2>
              <p>
                By creating an account, creating an email address, using the
                API, or otherwise using this deployed SpinupMail service, you
                agree to these Terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                2. What the Service Does
              </h2>
              <p>
                The service provides disposable email address management,
                receives inbound messages through Cloudflare Email Routing, and
                stores message content and attachments so you can access them in
                the app or API.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                3. Your Responsibilities
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  You must use the service lawfully and only for legitimate
                  purposes.
                </li>
                <li>
                  You are responsible for any email addresses you create and any
                  content you receive, store, forward, download, or act on.
                </li>
                <li>
                  You must not use the service for spam, phishing, malware,
                  unauthorized interception, harassment, or other abusive or
                  unlawful activity.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                4. Attachments and Inbound Content Risk
              </h2>
              <p>
                Inbound emails and attachments may be harmful, illegal, or
                inappropriate. You are solely responsible for reviewing and
                handling inbound content safely, including scanning downloaded
                files and applying your own security controls.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                5. API Keys and Security
              </h2>
              <p>
                You are responsible for securing your credentials and API keys.
                Activity performed with your account or keys is treated as your
                activity.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                6. Availability and Changes
              </h2>
              <p>
                The service may change, be suspended, or be discontinued at any
                time. Features may be added, removed, or modified without prior
                notice.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                7. Disclaimer of Warranties
              </h2>
              <p>
                The service is provided "as is" and "as available" without
                warranties of any kind, including warranties of merchantability,
                fitness for a particular purpose, and non-infringement.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                8. Limitation of Liability
              </h2>
              <p>
                To the fullest extent allowed by law, the service operator is
                not liable for indirect, incidental, special, consequential, or
                punitive damages, or for loss of data, profits, or business
                arising from your use of the service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                9. Indemnification
              </h2>
              <p>
                You agree to defend, indemnify, and hold harmless the service
                operator from claims, damages, losses, and expenses arising from
                your use of the service or violation of these Terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                10. Termination
              </h2>
              <p>
                Access may be suspended or terminated at any time for abuse,
                security issues, legal risk, or violation of these Terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                11. Contact
              </h2>
              <p>
                For legal or privacy inquiries, contact the operator of this
                deployed service through its published support channel.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
