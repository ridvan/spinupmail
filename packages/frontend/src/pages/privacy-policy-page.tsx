import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const effectiveDate = "February 15, 2026";

export const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>Effective date: {effectiveDate}</p>
          <div className="flex items-center gap-3">
            <Link className="underline underline-offset-4" to="/terms">
              Terms of Service
            </Link>
            <Link className="underline underline-offset-4" to="/">
              Dashboard
            </Link>
          </div>
        </div>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-2xl">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-muted-foreground">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                1. Scope
              </h2>
              <p>
                This policy explains how this deployed SpinupMail service
                collects, uses, stores, and discloses personal data when you use
                the app or API.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                2. Data We Collect
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Account data, such as email address, profile details, and
                  organization membership.
                </li>
                <li>
                  Authentication and security data, such as sessions, API key
                  metadata, and 2FA state.
                </li>
                <li>
                  Inbox data, such as inbound message content, headers,
                  metadata, and attachments.
                </li>
                <li>
                  Operational data, such as logs, request metadata, and abuse
                  prevention signals.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                3. How We Use Data
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Provide and maintain the service.</li>
                <li>Authenticate users and secure accounts.</li>
                <li>
                  Receive, store, and display inbound emails and attachments.
                </li>
                <li>Prevent abuse, fraud, and security incidents.</li>
                <li>Comply with legal obligations.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                4. Data Sharing
              </h2>
              <p>
                Data is shared only as needed to operate the service, such as
                infrastructure and email providers (for example Cloudflare and
                Resend), or when required by law.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                5. Data Retention
              </h2>
              <p>
                Data is retained for as long as needed to operate the service,
                enforce terms, resolve disputes, and meet legal obligations.
                Deleted accounts or addresses may leave residual backup or log
                data for a limited period.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                6. Security
              </h2>
              <p>
                Reasonable technical and organizational safeguards are used, but
                no system is completely secure. You are responsible for securing
                your own devices, credentials, and downloaded attachments.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                7. Your Choices and Rights
              </h2>
              <p>
                Depending on applicable law, you may have rights to access,
                correct, delete, or export your data, and to object to certain
                processing. Requests should be sent to the operator of this
                deployed service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                8. Cross-Border Processing
              </h2>
              <p>
                Data may be processed in countries other than your own where
                service providers operate infrastructure.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                9. Changes to this Policy
              </h2>
              <p>
                This policy may be updated from time to time. Continued use of
                the service after updates means you accept the revised policy.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                10. Contact
              </h2>
              <p>
                For privacy requests or legal questions, contact the operator of
                this deployed service through its published support channel.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
