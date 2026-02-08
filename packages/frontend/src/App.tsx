import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth";
import {
  createEmailAddress,
  type EmailAddress,
  type EmailMessage,
  listDomains,
  listEmailAddresses,
  listEmails,
} from "@/lib/api";

type SessionState = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  };
};

type ApiKeyRow = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  createdAt: string | null;
};

const buildEmailPreview = (html: string) => {
  const safeHtml = html.trim();
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'" />
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        padding: 16px;
        font-family: "Geist Variable", "Geist", ui-sans-serif, system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #0f172a;
        background: #ffffff;
        word-wrap: break-word;
      }
      img { max-width: 100%; height: auto; }
      a { color: #2563eb; text-decoration: underline; }
      pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
      blockquote { margin: 0; padding-left: 12px; border-left: 3px solid #e2e8f0; color: #475569; }
    </style>
  </head>
  <body>${safeHtml}</body>
</html>`;
};

const normalizeApiKeyRow = (row: {
  id: string;
  name?: string | null;
  start?: string | null;
  prefix?: string | null;
  createdAt?: string | Date | null;
}): ApiKeyRow => ({
  id: row.id,
  name: row.name ?? null,
  start: row.start ?? null,
  prefix: row.prefix ?? null,
  createdAt:
    typeof row.createdAt === "string"
      ? row.createdAt
      : row.createdAt
        ? row.createdAt.toISOString()
        : null,
});

export function App() {
  const [session, setSession] = React.useState<SessionState | null>(null);
  const [sessionLoading, setSessionLoading] = React.useState(true);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const [signInEmail, setSignInEmail] = React.useState("");
  const [signInPassword, setSignInPassword] = React.useState("");
  const [signUpName, setSignUpName] = React.useState("");
  const [signUpEmail, setSignUpEmail] = React.useState("");
  const [signUpPassword, setSignUpPassword] = React.useState("");

  const [addresses, setAddresses] = React.useState<EmailAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = React.useState(false);
  const [selectedAddressId, setSelectedAddressId] = React.useState<
    string | null
  >(null);

  const [emails, setEmails] = React.useState<EmailMessage[]>([]);
  const [emailsLoading, setEmailsLoading] = React.useState(false);
  const [selectedEmail, setSelectedEmail] = React.useState<EmailMessage | null>(
    null
  );

  const [newPrefix, setNewPrefix] = React.useState("test");
  const [newLocalPart, setNewLocalPart] = React.useState("");
  const [newTag, setNewTag] = React.useState("");
  const [newTtl, setNewTtl] = React.useState("");
  const [newDomain, setNewDomain] = React.useState<string | null>(null);
  const [availableDomains, setAvailableDomains] = React.useState<string[]>([]);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const [apiKeys, setApiKeys] = React.useState<ApiKeyRow[]>([]);
  const [apiKeyName, setApiKeyName] = React.useState("");
  const [apiKeySecret, setApiKeySecret] = React.useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = React.useState<string | null>(null);

  const loadSession = React.useCallback(async () => {
    setSessionLoading(true);
    const res = await authClient.getSession();
    if (res.error || !res.data?.session || !res.data?.user) {
      setSession(null);
      setSessionLoading(false);
      return;
    }
    setSession({ user: res.data.user });
    setSessionLoading(false);
  }, []);

  const loadAddresses = React.useCallback(async () => {
    setAddressesLoading(true);
    try {
      const items = await listEmailAddresses();
      setAddresses(items);
      if (!selectedAddressId && items.length > 0) {
        setSelectedAddressId(items[0].id);
      }
    } finally {
      setAddressesLoading(false);
    }
  }, [selectedAddressId]);

  const loadDomains = React.useCallback(async () => {
    try {
      const data = await listDomains();
      const items = data.items ?? [];
      setAvailableDomains(items);
      setNewDomain(data.default ?? items[0] ?? null);
    } catch {
      setAvailableDomains([]);
      setNewDomain(null);
    }
  }, []);

  const loadEmails = React.useCallback(async (addressId: string | null) => {
    if (!addressId) {
      setEmails([]);
      setSelectedEmail(null);
      return;
    }
    setEmailsLoading(true);
    try {
      const data = await listEmails({ addressId, limit: 30, order: "desc" });
      setEmails(data.items);
      setSelectedEmail(data.items[0] ?? null);
    } finally {
      setEmailsLoading(false);
    }
  }, []);

  const loadApiKeys = React.useCallback(async () => {
    const res = await authClient.apiKey.list();
    if (res.error) {
      setApiKeys([]);
      return;
    }
    const rows = (res.data ?? []).map(item => normalizeApiKeyRow(item));
    setApiKeys(rows);
  }, []);

  React.useEffect(() => {
    void loadSession();
  }, [loadSession]);

  React.useEffect(() => {
    if (!session) return;
    void loadAddresses();
    void loadApiKeys();
    void loadDomains();
  }, [session, loadAddresses, loadApiKeys, loadDomains]);

  React.useEffect(() => {
    if (!session) return;
    void loadEmails(selectedAddressId);
  }, [session, selectedAddressId, loadEmails]);

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    const res = await authClient.signIn.email({
      email: signInEmail,
      password: signInPassword,
    });
    if (res.error) {
      setAuthError(res.error.message || "Sign in failed");
      return;
    }
    await loadSession();
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    const res = await authClient.signUp.email({
      name: signUpName,
      email: signUpEmail,
      password: signUpPassword,
    });
    if (res.error) {
      setAuthError(res.error.message || "Sign up failed");
      return;
    }
    await loadSession();
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    setSession(null);
    setAddresses([]);
    setEmails([]);
    setSelectedEmail(null);
  };

  const handleCreateAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    const ttlMinutes = newTtl ? Number(newTtl) : undefined;
    try {
      await createEmailAddress({
        prefix: newPrefix || undefined,
        localPart: newLocalPart || undefined,
        tag: newTag || undefined,
        ttlMinutes:
          ttlMinutes && !Number.isNaN(ttlMinutes) ? ttlMinutes : undefined,
        domain: newDomain || undefined,
      });
      setNewLocalPart("");
      setNewTag("");
      setNewTtl("");
      await loadAddresses();
    } catch (error) {
      setCreateError((error as Error).message);
    }
  };

  const handleCreateApiKey = async () => {
    setApiKeyError(null);
    setApiKeySecret(null);
    const res = await authClient.apiKey.create({
      name: apiKeyName || undefined,
    });
    if (res.error) {
      setApiKeyError(res.error.message || "Failed to create API key");
      return;
    }
    const created = res.data as { key?: string } | null;
    setApiKeySecret(created?.key ?? null);
    setApiKeyName("");
    await loadApiKeys();
  };

  const handleDeleteApiKey = async (keyId: string) => {
    await authClient.apiKey.delete({ keyId });
    await loadApiKeys();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_55%),radial-gradient(circle_at_bottom,rgba(14,116,144,0.18),transparent_60%)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 border-b border-foreground/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Spinupmail
            </p>
            <h1 className="text-3xl font-semibold text-foreground">
              Inbox Workspace
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Generate addresses, inspect email payloads, and issue API keys for
              automation.
            </p>
          </div>
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {session.user.email}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          ) : null}
        </header>

        {sessionLoading ? (
          <div className="py-16 text-sm text-muted-foreground">Loading…</div>
        ) : session ? (
          <div className="grid gap-6 pt-8 md:grid-cols-[1.1fr_1.4fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create Address</CardTitle>
                  <CardDescription>
                    Use a prefix or custom local part to generate a new inbox.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleCreateAddress}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="prefix">Prefix</Label>
                        <Input
                          id="prefix"
                          value={newPrefix}
                          onChange={event => setNewPrefix(event.target.value)}
                          placeholder="test"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="local-part">Custom local part</Label>
                        <Input
                          id="local-part"
                          value={newLocalPart}
                          onChange={event =>
                            setNewLocalPart(event.target.value)
                          }
                          placeholder="optional"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="tag">Tag</Label>
                        <Input
                          id="tag"
                          value={newTag}
                          onChange={event => setNewTag(event.target.value)}
                          placeholder="forgot-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ttl">TTL minutes</Label>
                        <Input
                          id="ttl"
                          value={newTtl}
                          onChange={event => setNewTtl(event.target.value)}
                          placeholder="60"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="domain">Domain</Label>
                      {availableDomains.length <= 1 ? (
                        <Input
                          id="domain"
                          value={availableDomains[0] ?? ""}
                          disabled
                        />
                      ) : (
                        <select
                          id="domain"
                          value={newDomain ?? ""}
                          onChange={event =>
                            setNewDomain(event.target.value || null)
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {availableDomains.map(domain => (
                            <option key={domain} value={domain}>
                              {domain}
                            </option>
                          ))}
                        </select>
                      )}
                      {availableDomains.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No domains configured.
                        </p>
                      ) : null}
                    </div>
                    {createError ? (
                      <p className="text-sm text-destructive">{createError}</p>
                    ) : null}
                    <Button type="submit">Create address</Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Email Addresses</CardTitle>
                  <CardDescription>
                    Select an address to inspect incoming emails.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {addressesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : addresses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No addresses yet. Create one to start receiving mail.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {addresses.map(address => (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => setSelectedAddressId(address.id)}
                          className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                            selectedAddressId === address.id
                              ? "border-primary/70 bg-primary/10"
                              : "border-foreground/10 hover:border-primary/40"
                          }`}
                        >
                          <div className="text-sm font-medium">
                            {address.address}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last received {address.lastReceivedAt ?? "never"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Inbox</CardTitle>
                  <CardDescription>
                    Latest messages for the selected address.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
                  <div className="space-y-3">
                    {emailsLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : emails.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No emails yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {emails.map(message => (
                          <button
                            key={message.id}
                            type="button"
                            onClick={() => setSelectedEmail(message)}
                            className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                              selectedEmail?.id === message.id
                                ? "border-primary/70 bg-primary/10"
                                : "border-foreground/10 hover:border-primary/40"
                            }`}
                          >
                            <div className="text-sm font-medium">
                              {message.subject || "No subject"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {message.from}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {message.receivedAt ?? "unknown time"}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {selectedEmail ? (
                      <>
                        <div>
                          <p className="text-sm font-medium">
                            {selectedEmail.subject || "No subject"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            From {selectedEmail.from} •{" "}
                            {selectedEmail.receivedAt ?? "unknown time"}
                          </p>
                        </div>
                        <Separator />
                        {selectedEmail.html ? (
                          <div className="overflow-hidden rounded-md border border-foreground/10 bg-white">
                            <iframe
                              title="Email preview"
                              sandbox=""
                              className="h-80 w-full"
                              srcDoc={buildEmailPreview(selectedEmail.html)}
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                          </div>
                        ) : selectedEmail.text ? (
                          <Textarea
                            readOnly
                            className="min-h-65 font-mono text-xs"
                            value={selectedEmail.text}
                          />
                        ) : (
                          <Textarea
                            readOnly
                            className="min-h-65 font-mono text-xs"
                            value={selectedEmail.raw ?? ""}
                          />
                        )}
                        {selectedEmail.raw ? (
                          <details className="rounded-md border border-foreground/10 p-3 text-xs">
                            <summary className="cursor-pointer text-sm font-medium">
                              Raw source
                            </summary>
                            <Textarea
                              readOnly
                              className="mt-3 min-h-65 font-mono text-xs"
                              value={selectedEmail.raw}
                            />
                          </details>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Select an email to view raw content.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>
                    Generate keys for automation access.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Input
                      value={apiKeyName}
                      onChange={event => setApiKeyName(event.target.value)}
                      placeholder="Key name (optional)"
                    />
                    <Button type="button" onClick={handleCreateApiKey}>
                      Create key
                    </Button>
                  </div>
                  {apiKeyError ? (
                    <p className="text-sm text-destructive">{apiKeyError}</p>
                  ) : null}
                  {apiKeySecret ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                      <p className="font-medium">New key</p>
                      <p className="break-all text-xs">{apiKeySecret}</p>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    {apiKeys.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No API keys yet.
                      </p>
                    ) : (
                      apiKeys.map(key => (
                        <div
                          key={key.id}
                          className="flex items-center justify-between rounded-lg border border-foreground/10 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {key.name || "Untitled key"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {key.prefix ?? ""}
                              {key.start ?? ""}•••
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteApiKey(key.id)}
                          >
                            Revoke
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 pt-8 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sign in</CardTitle>
                <CardDescription>
                  Access your inbox workspace with email and password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSignIn}>
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={signInEmail}
                      onChange={event => setSignInEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInPassword}
                      onChange={event => setSignInPassword(event.target.value)}
                      required
                    />
                  </div>
                  {authError ? (
                    <p className="text-sm text-destructive">{authError}</p>
                  ) : null}
                  <Button type="submit">Sign in</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Create account</CardTitle>
                <CardDescription>
                  Register once to start issuing addresses and keys.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSignUp}>
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Name</Label>
                    <Input
                      id="signup-name"
                      value={signUpName}
                      onChange={event => setSignUpName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signUpEmail}
                      onChange={event => setSignUpEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signUpPassword}
                      onChange={event => setSignUpPassword(event.target.value)}
                      required
                    />
                  </div>
                  {authError ? (
                    <p className="text-sm text-destructive">{authError}</p>
                  ) : null}
                  <Button type="submit" variant="outline">
                    Create account
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
