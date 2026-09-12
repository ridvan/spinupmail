# Agent operations

The TypeScript SDK, JSON CLI, local stdio MCP server, OpenAPI document, and
compact agent guide are all derived from the same v1 operation registry. Run
`pnpm run check:agent-contracts` to prove the generated files are current.

## Environment

```env
SPINUPMAIL_BASE_URL="http://localhost:8787"
SPINUPMAIL_AGENT_CREDENTIAL="smai_v1_<credential-id>.<secret>"
SPINUPMAIL_ORGANIZATION_ID="<organization-id>"
```

Enrollment uses `SPINUPMAIL_ENROLLMENT_TOKEN` instead of an agent credential.
Never pass either secret on the command line.

## TypeScript SDK

```ts
import { SpinupMailAgentClient } from "spinupmail/agent";

const agent = new SpinupMailAgentClient();
const inboxes = await agent.listInboxes();
const messages = await agent.listMessages({ inboxId: inboxes.items[0].id });

const draftId = crypto.randomUUID();
await agent.createDraft(
  {
    id: draftId,
    inboxId: inboxes.items[0].id,
    to: ["allowed@example.net"],
    subject: "Re: status",
    bodyText: "The job completed successfully.",
  },
  { idempotencyKey: `draft-${draftId}` }
);
```

To enroll without sending a client secret to another service, give the SDK the
one-use token. It creates a 32-byte secret locally and returns the assembled
credential token once:

```ts
const bootstrap = new SpinupMailAgentClient();
const enrolled = await bootstrap.enroll(
  {
    enrollmentToken: process.env.SPINUPMAIL_ENROLLMENT_TOKEN!,
    agentName: "triage-agent",
    requestedInbox: { localPart: "triage", domain: "example.com" },
  },
  { idempotencyKey: "enroll-triage-2026-09-12" }
);

// Store enrolled.credentialToken in a secret manager, then discard this value.
```

Client calls accept an `AbortSignal` and deadline. The client follows redirects
manually: credentials and organization headers are removed from cross-origin
GET redirects, and cross-origin redirects with request bodies are rejected.

## JSON CLI

The CLI reads one JSON request envelope from stdin and writes one JSON result to
stdout. Operation names match the registry.

```bash
printf '%s\n' '{"query":{"limit":25}}' | spinupmail-agent listInboxes
```

Enrollment keeps its token in the environment:

```bash
printf '%s\n' '{"body":{"agentName":"triage-agent","requestedInbox":{"localPart":"triage","domain":"example.com"}},"idempotencyKey":"enroll-triage-2026-09-12"}' \
  | SPINUPMAIL_ENROLLMENT_TOKEN="$TOKEN" spinupmail-agent enrollAgent
```

The CLI rejects `--credential` and `--enrollment-token`. Binary download results
are returned as base64 JSON.

## Local stdio MCP

Start the MCP server with its credential in the environment:

```bash
SPINUPMAIL_AGENT_CREDENTIAL="$TOKEN" spinupmail-mcp
```

Its tools are generated from operations explicitly marked MCP-safe. It exposes
capability inspection, granted inbox/message/thread access, drafts, submission,
delivery outcomes, and event polling. It intentionally omits enrollment,
credential administration, raw/attachment downloads, human approval, sending
policy, provider ingestion, billing/entitlement, and fleet operations.

The MCP transport is local line-delimited stdio JSON-RPC. Hosted MCP and OAuth
are not part of this pilot.

## Authorization boundaries

| Boundary                 | Allowed work                                          |
| ------------------------ | ----------------------------------------------------- |
| Public                   | Read discovery, OpenAPI, and `llms.txt` only          |
| Enrollment token         | Exchange one bounded, expiring token once             |
| Agent bearer             | Only granted inboxes and whitelisted capabilities     |
| Human organization admin | Enrollment, revocation, exact approval, policy, usage |
| Platform operator        | Fleet-wide outbound kill switch                       |
| Provider secret          | Delivery-event ingestion only                         |

Creation and irreversible-send operations require `Idempotency-Key`. Repeating
the same key and canonical input returns the original resource. Reusing the key
with different input returns `409 Conflict`.

Errors have a stable `error.code`, a safe message, and an `error.requestId` that
operators can correlate without logging credentials or message content.
