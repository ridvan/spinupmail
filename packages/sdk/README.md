# SpinupMail SDK

[SpinupMail](https://spinupmail.com) TypeScript SDK for creating and reading temporary email addresses.

## Install

```bash
pnpm install spinupmail
```

## Usage

```ts
import { SpinupMail } from "spinupmail";

const spinupmail = new SpinupMail();

const address = await spinupmail.addresses.create({
  acceptedRiskNotice: true,
});

const email = await spinupmail.inboxes.waitForEmail({
  addressId: address.id,
  after: new Date(),
  subjectIncludes: "verify",
  timeoutMs: 30_000,
});

console.log(email.subject);
```

`new SpinupMail()` defaults to:

- `process.env.SPINUPMAIL_API_KEY`
- `process.env.SPINUPMAIL_BASE_URL` or `https://api.spinupmail.com`
- `process.env.SPINUPMAIL_ORGANIZATION_ID` or `process.env.SPINUPMAIL_ORG_ID`

You can override any of them:

```ts
import { SpinupMail } from "spinupmail";

const spinupmail = new SpinupMail({
  apiKey: "spin_other_key",
  organizationId: "org_123",
});
```

If you omit `localPart`, the SDK generates a random valid inbox name before sending the request.

Use `search` to match recent emails by indexed content:

```ts
const email = await spinupmail.inboxes.waitForEmail({
  addressId: address.id,
  search: "verify",
  timeoutMs: 30_000,
});

const emails = await spinupmail.emails.list({
  addressId: address.id,
  search: "verify",
});
```

List inbox emails with pagination:

```ts
const page = await spinupmail.emails.list({
  addressId: address.id,
  page: 1,
  pageSize: 25,
});
```

Use `after` with local filters to wait for a specific email after a timestamp:

```ts
const runStartedAt = new Date();

const email = await spinupmail.inboxes.waitForEmail({
  addressId: address.id,
  after: runStartedAt,
  subjectIncludes: "verify",
  bodyIncludes: "654321",
  timeoutMs: 30_000,
});

console.log(email.text);
```

Manage organization integrations:

```ts
const integrations = await spinupmail.integrations.list();

const dispatches = await spinupmail.integrations.listDispatches(
  integrations.items[0].id,
  { page: 1, pageSize: 20 }
);
```

## Agent inbox client

The v1 agent client uses an opaque bearer credential and the shared operation
contract:

```ts
import { SpinupMailAgentClient } from "spinupmail/agent";

const agent = new SpinupMailAgentClient();
const inboxes = await agent.listInboxes();
const messages = await agent.listMessages({
  inboxId: inboxes.items[0].id,
  search: "verification",
});
```

It reads these defaults:

- `SPINUPMAIL_AGENT_CREDENTIAL`
- `SPINUPMAIL_BASE_URL` or `https://api.spinupmail.com`
- `SPINUPMAIL_ORGANIZATION_ID` or `SPINUPMAIL_ORG_ID`

The SDK generates enrollment credential secrets locally, supports abort signals
and deadlines, and prevents credential forwarding through unsafe redirects.
Store the one-time `credentialToken` result immediately; the service stores only
its hash and cannot recover it.

The package also installs:

- `spinupmail-agent`: one JSON operation envelope from stdin and one JSON result
  on stdout
- `spinupmail-mcp`: a local line-delimited stdio MCP server containing only the
  operation-registry tools marked safe for agents

Supply credentials and enrollment tokens through environment configuration,
never command arguments. Outbound delivery remains disabled by default and
requires server, fleet, workspace, domain, entitlement, recipient, suppression,
and quota gates.

See the repository's
[agent inbox guide](https://github.com/ridvan/spinupmail/blob/main/docs/agent-inboxes.md)
and
[operation examples](https://github.com/ridvan/spinupmail/blob/main/docs/agent-operations.md).
