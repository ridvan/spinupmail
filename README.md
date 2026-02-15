# Spinupmail

Spinupmail is a Cloudflare Email Routing + Workers app for generating disposable
email addresses, storing inbound messages, and reading them via API (session
cookies or API keys). It includes a Hono API backend and a React + shadcn UI
frontend.

## What You Get

- Create unlimited email addresses scoped to an organization
- Create and join organizations (max 3 per user, max 10 members per org)
- Receive emails via Cloudflare Email Routing and store them in D1
- Browse organization-scoped emails in the UI
- Store inbound mail attachments in Cloudflare R2 and download them in UI/API
- Generate API keys for automation (e.g., test suites)
- Require verified email before account access (verification sent via Resend)

## Prerequisites

- A Cloudflare account with a domain using Cloudflare nameservers
- Email Routing enabled for the domain
- `pnpm` installed

## Repo Layout

- `packages/backend` — Cloudflare Worker (Hono + Better Auth + D1 + KV + R2)
- `packages/frontend` — React + shadcn UI (Vite)

## 1. Install Dependencies

From the repo root:

```bash
pnpm install
```

## 2. Configure Cloudflare Resources

### D1 Database

```bash
pnpm exec wrangler d1 create SUM_DB
```

### KV Namespace

```bash
pnpm exec wrangler kv namespace create SUM_KV
```

### R2 Bucket (Attachments)

Create buckets for attachment storage:

```bash
pnpm exec wrangler r2 bucket create spinupmail-attachments
pnpm exec wrangler r2 bucket create spinupmail-attachments-preview
```

Copy the example config and update IDs:

```bash
cp packages/backend/wrangler.toml.example \
  packages/backend/wrangler.toml
```

Edit `packages/backend/wrangler.toml` with:

- `[[d1_databases]].database_id`
- `[[kv_namespaces]].id`
- `[[r2_buckets]].bucket_name` (e.g. `spinupmail-attachments`)
- `[[r2_buckets]].preview_bucket_name` (e.g. `spinupmail-attachments-preview`)
- `[vars].EMAIL_DOMAIN` (single domain fallback)
- `[vars].EMAIL_DOMAINS` (comma-separated list, recommended)
- Optional:
  - `[vars].EMAIL_MAX_BYTES`
  - `[vars].EMAIL_BODY_MAX_BYTES`
  - `[vars].EMAIL_FORWARD_TO`
  - `[vars].EMAIL_ATTACHMENT_MAX_BYTES`
  - `[vars].RESEND_FROM_EMAIL` (e.g. `Spinupmail <verify@your-domain.com>`)
  - `[vars].EMAIL_STORE_HEADERS_IN_DB`
  - `[vars].EMAIL_STORE_RAW_IN_DB`
  - `[vars].EMAIL_STORE_RAW_IN_R2`

## 3. Better Auth Secrets

Set the secrets for the Worker:

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put BETTER_AUTH_BASE_URL
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
```

Use the Worker URL or your API route URL:

- `BETTER_AUTH_BASE_URL = https://<your-domain>/api/auth`
- `RESEND_API_KEY = re_...`
- `TURNSTILE_SECRET_KEY = <Cloudflare Turnstile secret key>`
- `RESEND_FROM_EMAIL` should be configured in `wrangler.toml` `[vars]` with a verified sender/domain.

## 4. Database Migrations

Do **not** hand-edit migrations.

```bash
pnpm -C packages/backend db:generate
pnpm exec wrangler d1 migrations apply SUM_DB --remote
```

## 5. Deploy the Backend Worker

```bash
pnpm -C packages/backend deploy
```

## 6. Configure Email Routing (Cloudflare Dashboard)

1. Enable **Email Routing** for your domain
2. Add at least one destination address (verification email required)
3. Create a **Routing rule**:
   - Address: `*@your-domain.com`
   - Action: **Send to Worker**
   - Worker: `spinupmail` (or your deployed Worker name)

If you use multiple domains, repeat the routing rule for each domain you add to
`EMAIL_DOMAINS`.

## Multiple Domains

To support multiple inbound domains, configure them in the Worker and add Email
Routing rules for each domain.

### 1) Worker config

In `packages/backend/wrangler.toml`:

```
[vars]
EMAIL_DOMAINS = "spinupmail.com,spinuptestdomain.com"
```

`EMAIL_DOMAIN` is still supported as a fallback, but `EMAIL_DOMAINS` is the
recommended source of truth.

### 2) Email Routing rules

For **each domain** listed in `EMAIL_DOMAINS`:

1. Enable Email Routing for that domain in Cloudflare.
2. Add a destination address (verify it once per domain).
3. Create a routing rule:
   - Address: `*@that-domain.com`
   - Action: **Send to Worker**
   - Worker: your deployed Worker name.

### 3) UI behavior

When multiple domains are configured, the UI shows a **domain selector** during
address creation. If only one domain is configured, it is used automatically.

## 7. Deploy the Frontend (Cloudflare Pages)

Create a **Pages** project (not a Worker). The UI can be confusing, explicitly choose "Pages".

Build settings:

- Root directory: `packages/frontend`
- Build command: `pnpm run build`
- Build output directory: `dist`

### Environment Variables (Pages)

If you route the Worker on the same domain at `/api/*`, you can set:

- `VITE_AUTH_BASE_URL = /api/auth`
- `VITE_API_BASE_URL = /api`
- `VITE_TURNSTILE_SITE_KEY = <Cloudflare Turnstile site key>`

If you prefer a separate API domain:

- `VITE_AUTH_BASE_URL = https://api.your-domain.com/api/auth`
- `VITE_API_BASE_URL = https://api.your-domain.com`
- `VITE_TURNSTILE_SITE_KEY = <Cloudflare Turnstile site key>`

## 8. Route API Requests to the Worker

If your frontend is on `https://your-domain.com`, add a Worker route:

- `your-domain.com/api/*` → `spinupmail` Worker
- (Optional) `www.your-domain.com/api/*` → `spinupmail` Worker

This keeps the frontend and API on the same domain.

## Using the App

1. Open the Pages URL
2. Sign up / sign in
3. Create a new organization or join one using an invitation link
4. Create a new email address
5. Send an email to that address
6. View emails in the UI

## API Usage (Automation)

Generate an API key from the UI. Then use it to access the API:

- API key requests must include `X-Org-Id` with an organization the API key
  owner belongs to.
- Session-cookie requests use the active organization from the user session.

```bash
curl "https://your-domain.com/api/email-addresses" \
  -H "X-API-Key: <your_api_key>" \
  -H "X-Org-Id: <organization_id>"
```

```bash
curl "https://your-domain.com/api/emails?address=john-123@your-domain.com" \
  -H "X-API-Key: <your_api_key>" \
  -H "X-Org-Id: <organization_id>"
```

Download an email attachment:

```bash
curl -L "https://your-domain.com/api/emails/<email_id>/attachments/<attachment_id>" \
  -H "X-API-Key: <your_api_key>" \
  -H "X-Org-Id: <organization_id>" \
  --output attachment.bin
```

## Attachment Process

Attachment handling is part of the inbound email pipeline:

1. Email is received by the Worker through Cloudflare Email Routing.
2. MIME content is parsed with `postal-mime` (including attachments).
3. Each attachment is validated and uploaded to the `R2_BUCKET` binding under:
   - `email-attachments/<organizationId>/<addressId>/<emailId>/<attachmentId>-<filename>`
4. Metadata is saved in D1 table `email_attachments` with ownership links (`organization_id`, `user_id`, `address_id`, `email_id`).
5. `/api/emails` and `/api/emails/:id` include attachment metadata for UI/API consumers.
6. Downloads are served through authenticated endpoint:
   - `GET /api/emails/:id/attachments/:attachmentId`
   - Access is restricted to members of the owning organization (session cookie or API key + `X-Org-Id`).
7. Raw MIME is **not persisted in D1 by default**. Optional debug mode can store
   raw MIME in private R2 and serve it through:
   - `GET /api/emails/:id/raw`
   - Access is restricted to members of the owning organization (session cookie or API key + `X-Org-Id`).

Limits:

- `EMAIL_MAX_BYTES`: max raw email bytes read/parsed by Worker (default `524288`).
- `EMAIL_BODY_MAX_BYTES`: max HTML/text bytes stored per email row in D1 (`524288` default). Oversized bodies are dropped to avoid DB write failures.
- `EMAIL_ATTACHMENT_MAX_BYTES`: max size per attachment uploaded to R2 (default `10485760`).
- `EMAIL_STORE_HEADERS_IN_DB`: persist full header JSON in D1 (`false` by default).
- `EMAIL_STORE_RAW_IN_DB`: persist full raw MIME in D1 (`false` by default).
- `EMAIL_STORE_RAW_IN_R2`: persist full raw MIME in private R2 (`false` by default).

## Local Development

Backend:

```bash
pnpm -C packages/backend dev
```

Frontend:

```bash
pnpm -C packages/frontend dev
```

Set `.env` for frontend local dev if needed:

```
VITE_AUTH_BASE_URL=http://localhost:8787/api/auth
VITE_API_BASE_URL=http://localhost:8787
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

For local auth, add a `packages/backend/.dev.vars`
file (not committed):

```
BETTER_AUTH_SECRET=dev-secret
BETTER_AUTH_BASE_URL=http://localhost:8787/api/auth
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

The frontend dev server proxies `/api/*` to `http://127.0.0.1:8787`, so you can
use relative URLs during development.

### Local Email Testing

Cloudflare does **not** deliver real emails to `.workers.dev` domains. For local
testing, simulate Email Routing via Wrangler’s local email endpoint:

```bash
curl --location 'http://localhost:8787/cdn-cgi/handler/email?from=sender%40example.com&to=test-82bdbbd2%40spinupmail.com' \
--header 'Content-Type: application/json' \
--data-raw 'Received: from smtp.example.com (127.0.0.1)
        by cloudflare-email.com (unknown) id 4fwwffRXOpyR
        for <recipient@example.com>; Tue, 27 Aug 2024 15:50:20 +0000
From: "John" <sender@example.com>
Reply-To: sender@example.com
To: recipient@example.com
Subject: Testing Email Workers Local Dev
Content-Type: text/html; charset="windows-1252"
X-Mailer: Curl
Date: Tue, 27 Aug 2024 08:49:44 -0700
Message-ID: <6114391943504294873000@ZSH-GHOSTTY>

Hi there'
```

To receive **real** emails, use a real domain in Cloudflare Email Routing (you
can create a dev subdomain like `dev.your-domain.com`) and point the routing
rule to your Worker.

## Notes

- Email addresses **must** be created before email is sent. Unknown addresses
  are rejected.
- HTML is sanitized on the backend and rendered inside a sandboxed iframe.
