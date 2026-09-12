import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAgentMail } from "@/features/agent-mail/hooks/use-agent-mail";

const dateTime = (value: number | null | undefined) =>
  value ? new Date(value).toLocaleString() : "Not available";

const stateBadge = (state: string) => (
  <Badge
    variant={
      ["failed", "bounced", "complained", "uncertain"].includes(state)
        ? "destructive"
        : state === "delivered"
          ? "default"
          : "secondary"
    }
  >
    {state}
  </Badge>
);

export const AgentMailDashboard = () => {
  const [selectedInboxId, setSelectedInboxId] = React.useState<string | null>(
    null
  );
  const [selectedThread, setSelectedThread] = React.useState<{
    inboxId: string;
    threadId: string;
  } | null>(null);
  const [agentName, setAgentName] = React.useState("Mailbox agent");
  const [enrollmentToken, setEnrollmentToken] = React.useState<string | null>(
    null
  );
  const data = useAgentMail(
    selectedInboxId ?? null,
    selectedThread?.inboxId === selectedInboxId ? selectedThread.threadId : null
  );
  const inboxes = data.inboxes.data?.items ?? [];
  const activeInboxId = selectedInboxId;

  if (data.capabilities.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading agent mail controls…
      </p>
    );
  }
  if (data.capabilities.error) {
    return (
      <p className="text-sm text-destructive">
        {data.capabilities.error.message}
      </p>
    );
  }
  if (!data.canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent mail oversight</CardTitle>
          <CardDescription>
            A workspace owner or administrator is required. The API enforces
            this boundary.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sendingEnabled = Boolean(data.policy.data?.policy.sendingEnabled);
  const fleetEnabled = Boolean(data.fleet.data?.control.sendingEnabled);
  const suspension = data.policy.data?.policy.suspensionReason;

  const submitEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    setEnrollmentToken(null);
    const result = await data.enrollment.mutateAsync({
      name: agentName.trim(),
      capabilities: [
        "inboxes:create",
        "inboxes:read",
        "messages:read",
        "drafts:write",
        "events:read",
      ],
      inboxLimit: 1,
      credentialExpiresInDays: 30,
    });
    setEnrollmentToken(result.enrollmentToken);
  };

  return (
    <div className="space-y-4" data-testid="agent-mail-dashboard">
      <div>
        <h1 className="text-xl font-semibold">Agent mail</h1>
        <p className="text-sm text-muted-foreground">
          Enroll scoped agents, review replies, and monitor delivery without
          exposing stored secrets.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>One-time enrollment</CardTitle>
            <CardDescription>
              Enrollment tokens expire after 15 minutes. Two-factor
              authentication is required by the API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data.capabilities.data?.twoFactorEnabled ? (
              <p className="rounded-md bg-muted p-2 text-sm">
                Enable two-factor authentication before creating an enrollment.
              </p>
            ) : null}
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={submitEnrollment}
            >
              <Input
                aria-label="Agent name"
                value={agentName}
                onChange={event => setAgentName(event.target.value)}
                maxLength={80}
                required
              />
              <Button
                type="submit"
                disabled={
                  data.enrollment.isPending ||
                  !data.capabilities.data?.twoFactorEnabled ||
                  !agentName.trim()
                }
              >
                Create enrollment
              </Button>
            </form>
            {data.enrollment.error ? (
              <p className="text-sm text-destructive">
                {data.enrollment.error.message}
              </p>
            ) : null}
            {enrollmentToken ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium">
                  Copy this token now. It is shown once.
                </p>
                <output
                  className="block break-all font-mono text-xs"
                  aria-label="Enrollment token"
                >
                  {enrollmentToken}
                </output>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEnrollmentToken(null)}
                >
                  Clear token
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sending controls</CardTitle>
            <CardDescription>
              Sending remains off unless every server, fleet, workspace, domain,
              entitlement, policy, and quota gate passes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium">Workspace sending</span>
                <span className="text-xs text-muted-foreground">
                  {sendingEnabled
                    ? "Enabled for allowed or approved recipients"
                    : "Disabled"}
                </span>
              </span>
              <Switch
                aria-label="Workspace sending"
                checked={sendingEnabled}
                disabled={data.setSending.isPending}
                onCheckedChange={checked => data.setSending.mutate(checked)}
              />
            </div>
            {suspension ? (
              <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                Suspended: {suspension}
              </p>
            ) : null}
            {data.isOperator ? (
              <div className="flex items-center justify-between gap-4 border-t pt-4">
                <span>
                  <span className="block font-medium">Fleet kill switch</span>
                  <span className="text-xs text-muted-foreground">
                    {fleetEnabled
                      ? "Outbound fleet enabled"
                      : "Outbound fleet disabled"}
                  </span>
                </span>
                <Switch
                  aria-label="Fleet kill switch"
                  checked={fleetEnabled}
                  disabled={data.setFleet.isPending}
                  onCheckedChange={checked => data.setFleet.mutate(checked)}
                />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3 text-sm">
              <div>
                <span className="block text-muted-foreground">
                  Recipients used
                </span>
                <strong>
                  {data.usage.data?.usage.reservedRecipients ?? 0}
                </strong>
              </div>
              <div>
                <span className="block text-muted-foreground">Pilot limit</span>
                <strong>
                  {data.usage.data?.entitlement.monthlyRecipientLimit ?? 0}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agents and credentials</CardTitle>
            <CardDescription>
              Revocation takes effect on the next authenticated request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {(data.principals.data?.items ?? []).map(agent => (
                <div
                  key={agent.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {dateTime(agent.createdAt)}
                    </p>
                  </div>
                  {agent.revokedAt ? (
                    stateBadge("revoked")
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => data.revokePrincipal.mutate(agent.id)}
                    >
                      Revoke agent
                    </Button>
                  )}
                </div>
              ))}
              {!data.principals.isLoading &&
              !data.principals.data?.items.length ? (
                <p className="text-sm text-muted-foreground">
                  No enrolled agents.
                </p>
              ) : null}
            </div>
            <div className="space-y-2 border-t pt-4">
              {(data.credentials.data?.items ?? []).map(credential => (
                <div
                  key={credential.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div>
                    <p className="font-medium">{credential.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {dateTime(credential.expiresAt)} ·{" "}
                      {credential.capabilities.join(", ")}
                    </p>
                  </div>
                  {credential.revokedAt ? (
                    stateBadge("revoked")
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        data.revokeCredential.mutate(credential.id)
                      }
                    >
                      Revoke credential
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inboxes and RFC threads</CardTitle>
            <CardDescription>
              Select an inbox to inspect its thread history.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2" aria-label="Agent inboxes">
              {inboxes.map(inbox => (
                <Button
                  type="button"
                  size="sm"
                  variant={activeInboxId === inbox.id ? "default" : "outline"}
                  key={inbox.id}
                  onClick={() => {
                    setSelectedInboxId(inbox.id);
                    setSelectedThread(null);
                  }}
                >
                  {inbox.address}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                {(data.threads.data?.items ?? []).map(thread => (
                  <button
                    type="button"
                    key={thread.id}
                    className="block w-full rounded-md border p-2 text-left hover:bg-muted"
                    onClick={() =>
                      setSelectedThread({
                        inboxId: activeInboxId!,
                        threadId: thread.id,
                      })
                    }
                  >
                    <span className="block font-medium">
                      {thread.subject || "No subject"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {thread.messageCount} messages
                    </span>
                  </button>
                ))}
              </div>
              <div
                className="space-y-2 rounded-md bg-muted/40 p-3"
                aria-label="Thread messages"
              >
                {(data.thread.data?.messages ?? []).map(message => (
                  <article
                    key={message.id}
                    className="border-b pb-2 last:border-0"
                  >
                    <p className="text-xs text-muted-foreground">
                      {message.from} → {message.to}
                    </p>
                    <p className="font-medium">
                      {message.subject || "No subject"}
                    </p>
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm">
                      {message.bodyText || "HTML message"}
                    </p>
                  </article>
                ))}
                {!data.thread.data ? (
                  <p className="text-sm text-muted-foreground">
                    Select a thread.
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Draft review</CardTitle>
            <CardDescription>
              Editing a draft invalidates its exact-content approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.drafts.data?.items ?? []).map(draft => (
              <div
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{draft.subject || "No subject"}</p>
                  <p className="text-xs text-muted-foreground">
                    To {draft.to.join(", ")} · version {draft.version}
                  </p>
                </div>
                {draft.submittedAt ? (
                  stateBadge("submitted")
                ) : draft.approvedHash === draft.contentHash ? (
                  stateBadge("approved")
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      data.approveDraft.mutate({
                        id: draft.id,
                        version: draft.version,
                      })
                    }
                  >
                    Approve exact draft
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery outcomes</CardTitle>
            <CardDescription>
              Uncertain provider calls stay visible and are not resent
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.submissions.data?.items ?? []).map(submission => (
              <div key={submission.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{submission.id}</span>
                  {stateBadge(submission.state)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {submission.outcomes.map(outcome => (
                    <span key={outcome.recipient} className="text-xs">
                      {outcome.recipient} {stateBadge(outcome.state)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
