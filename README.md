<img height="340" alt="SpinupMail Banner" src="https://github.com/user-attachments/assets/7e88bf41-068b-4861-8d72-2e289f13a34f" />

<h3 align="center">
  SpinupMail
</h3>

<p align="center">
  Self-host unlimited temporary emails with attachments on Cloudflare
</p>

<p align="center">
  <a href="https://spinupmail.com"><img alt="SpinupMail Website" src="https://img.shields.io/badge/spinupmail.com-374151?labelColor=111827&logo=googlechrome&logoColor=white" /></a>
  <a href="https://spinupmail.com/docs"><img alt="SpinupMail Docs" src="https://img.shields.io/badge/Docs-475569?labelColor=111827&logo=gitbook&logoColor=white" /></a>
  <a href="https://deepwiki.com/ridvan/spinupmail"><img alt="DeepWiki" src="https://img.shields.io/badge/DeepWiki-374151?labelColor=111827&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==&logoColor=white" /></a>
  <a href="https://github.com/ridvan/spinupmail/actions/workflows/test.yml"><img alt="CI Test Pipeline" src="https://img.shields.io/github/actions/workflow/status/ridvan/spinupmail/test.yml?branch=main&label=CI&labelColor=111827" /></a>
  <a href="https://github.com/ridvan/spinupmail/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/github/license/ridvan/spinupmail?labelColor=111827" /></a>
  <a href="https://www.npmjs.com/package/spinupmail"><img alt="npm version" src="https://img.shields.io/npm/v/spinupmail?label=npm&labelColor=111827&color=7c2d12&logo=npm&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/spinupmail">
  <img
    alt="npm downloads"
    src="https://img.shields.io/npm/dm/spinupmail?label=downloads&labelColor=111827&color=57534e&logo=npm&logoColor=white"
  />
</a>
</p>

<hr />

Spinupmail is an open-source temporary email platform for teams, built on
Cloudflare Email Routing and Workers. It lets organizations create unlimited
mailboxes on their own domains, capture inbound messages (including
attachments), and manage everything through a secure Better Auth + Hono API and a modern React + Shadcn dashboard.

## Features

- Create unlimited email addresses scoped to an organization
- Create and join organizations (max 3 per user, max 10 members per org, both configurable)
- Receive emails via Cloudflare Email Routing and store them in D1
- Browse organization-scoped emails in the UI
- Store inbound mail attachments in Cloudflare R2 and download them in UI/API
- Generate API keys for automation (e.g., test suites)
- Route inbound email events to integrations for real-time notifications (Telegram provider available)

## Screenshots

<img width="200" alt="Image of SpinupMail Dashboard - Overview page" src="https://github.com/user-attachments/assets/e24c3860-b24e-44a7-9a82-d0004e3e09db" />
<img width="200" alt="Image of SpinupMail Dashboard - Inbox page" src="https://github.com/user-attachments/assets/0f5d503d-1e58-4743-bd33-b14e2b56b11b" />
<img width="200" alt="Image of SpinupMail Dashboard - Addresses page" src="https://github.com/user-attachments/assets/9cd5c44c-2890-425a-a1ff-19ad976ed8a2" />
<img width="200" alt="Image of SpinupMail Dashboard - Organization page" src="https://github.com/user-attachments/assets/10316158-22af-4764-81b8-8c99b6509cbc" />

## Prerequisites

- A Cloudflare account with a domain using Cloudflare nameservers
- Email Routing enabled for the domain

## Repo Layout

- `packages/backend` — Cloudflare Worker (Hono + Better Auth + D1 + KV + R2)
- `packages/frontend` — React + shadcn UI (Vite)

### Backend Source Structure

- `packages/backend/src/index.ts` — Worker entrypoint and API composition
- `packages/backend/src/app/` — app types and shared middleware
- `packages/backend/src/modules/` — domain modules (`auth-http`, `domains`, `organizations`, `email-addresses`, `emails`, `inbound-email`, `integrations`)
- `packages/backend/src/shared/` — shared constants, helpers, validation, and utilities
- `packages/backend/src/platform/` — platform integrations (auth runtime and DB client)

### Backend Import Style

- Backend TypeScript uses path aliases with `@/*` mapped to `packages/backend/src/*`.
- Prefer `@/shared/...`, `@/modules/...`, `@/platform/...`, and `@/app/...` for cross-folder imports.
- Keep `./...` imports for files in the same folder.

# Installation

## 1. Install Dependencies

From the repo root:

```bash
pnpm install
```

## 2. Configure Cloudflare Resources

Open the backend folder:

```bash
cd packages/backend
```

### Create D1 Database

```bash
pnpm exec wrangler d1 create SUM_DB
```

Save the returned `binding`, `database_name`, and `database_id` for the next steps.

### Create KV Namespace

```bash
pnpm exec wrangler kv namespace create SUM_KV
```

Save the returned `binding` and `id` for the next steps.

### Create R2 Bucket (Attachments)

Create buckets for attachment storage:

```bash
pnpm exec wrangler r2 bucket create spinupmail-attachments
```

Save the returned `bucket_name` values for the next steps. In
`packages/backend/wrangler.toml`, keep the Worker binding as `R2_BUCKET` and
set `bucket_name` to the actual Cloudflare bucket names.

### Create Queue (Integration Dispatches)

Spinupmail uses a queue worker to dispatch integration events in the background.
Create the queue used for integration dispatch jobs:

```bash
pnpm wrangler queues create spinupmail-integration-dispatches
```

### Durable Objects

This backend already includes the Durable Object binding and migration in
`packages/backend/wrangler.toml.example`:

- `[[durable_objects.bindings]]`
- `[[migrations]]` with `new_sqlite_classes = ["InboundAbuseCounterDurableObject"]`

For a fresh project, you do **not** run a separate "create durable object"
command. Cloudflare creates the Durable Object namespace when you deploy the
Worker with that migration, and individual Durable Object instances are created
automatically the first time the backend uses them.

Edit `packages/backend/wrangler.toml` with the created resource values:

- `[[d1_databases]].database_id`
- `[[kv_namespaces]].id`
- `[[r2_buckets]].bucket_name` (e.g. `spinupmail-attachments`)
- `[[r2_buckets]].preview_bucket_name` (e.g. `spinupmail-attachments-preview`)
- `[vars].EMAIL_DOMAINS` (comma-separated inbound domains, can be single domain like `spinupmail.com` or multiple domains like `spinupmail.com,spinupmail.dev`)
- `[vars].RESEND_FROM_EMAIL` (e.g. `Spinupmail <verify@spinupmail.com>`. Will be used when sending Verification/Password Reset emails.)
- Optional:
  - `[vars].AUTH_ALLOWED_EMAIL_DOMAIN` (restrict auth to one email domain. **Useful when you want to deploy an internal tool for your organization and restrict access to a specific domain.**)
  - `[vars].FORCED_MAIL_PREFIX` (when set, every created or renamed inbox is forced to start with this prefix plus `-`, for example `temp-`)
  - `[vars].EMAIL_MAX_BYTES`
  - `[vars].EMAIL_BODY_MAX_BYTES`
  - `[vars].EMAIL_FORWARD_TO`
  - `[vars].EMAIL_ATTACHMENT_MAX_BYTES`
  - `[vars].EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION` (default: `104857600`)
  - `[vars].EMAIL_ATTACHMENTS_ENABLED` (default: `true`)
  - `[vars].MAX_ADDRESSES_PER_ORGANIZATION` (default: `100`)
  - `[vars].MAX_RECEIVED_EMAILS_PER_ORGANIZATION` (default: `1000`)
  - `[vars].MAX_RECEIVED_EMAILS_PER_ADDRESS` (default: `100`)
  - `[vars].MAX_INTEGRATIONS_PER_ORGANIZATION` (default: `3`)
  - `[vars].MAX_INTEGRATION_DISPATCHES_PER_ORGANIZATION_PER_DAY` (default: `100`)
  - `[vars].OPERATIONAL_EVENT_RETENTION_DAYS` (default: `30`)
  - `[vars].OPERATIONAL_EVENT_MAX_METADATA_BYTES` (default: `4096`)
  - `[vars].OPERATIONAL_EVENT_NOISY_RATE_LIMIT_WINDOW_SECONDS` and `[vars].OPERATIONAL_EVENT_NOISY_RATE_LIMIT_MAX` (default: `300` seconds and `1` stored event per noisy event identity)
  - `[vars].API_KEY_RATE_LIMIT_WINDOW` and `[vars].API_KEY_RATE_LIMIT_MAX` (default: `60` seconds and `120` requests for `x-api-key` app traffic, including Better Auth runtime checks on `/get-session` and `/organization/get-full-organization`; these apply in addition to `AUTH_RATE_LIMIT_*` and `AUTH_CHANGE_EMAIL_RATE_LIMIT_*`)
  - `[vars].AUTH_RATE_LIMIT_WINDOW` (default: `60`)
  - `[vars].AUTH_RATE_LIMIT_MAX` (optional Better Auth global max override)
  - `[vars].AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW` (default: `3600`)
  - `[vars].AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX` (default: `2`)
  - `[vars].INTEGRATION_QUEUE_RETRY_WINDOW_SECONDS` (default: `21600`)
  - `[vars].INTEGRATION_QUEUE_BASE_DELAY_SECONDS` (default: `30`)
  - `[vars].INTEGRATION_QUEUE_MAX_DELAY_SECONDS` (default: `1800`)
  - `[vars].INTEGRATION_QUEUE_JITTER_SECONDS` (default: `10`)
  - `[vars].EXTENSION_REDIRECT_ORIGINS` (comma-separated exact redirect origins for trusted extension builds, for example `https://<extension-id>.chromiumapp.org`)
  - `[vars].EMAIL_STORE_HEADERS_IN_DB`
  - `[vars].EMAIL_STORE_RAW_IN_DB`
  - `[vars].EMAIL_STORE_RAW_IN_R2`

For local development, create `.dev.vars` file in `packages/backend`. Here is a sample file:

```env
BETTER_AUTH_BASE_URL="http://localhost:8787/api/auth"
BETTER_AUTH_SECRET="" # Run `openssl rand -base64 32` to generate, or you can generate from https://better-auth.com/docs/installation
INTEGRATION_SECRET_ENCRYPTION_KEY="" # Run `openssl rand -base64 32` to generate a base64 32-byte key
CORS_ORIGIN="http://localhost:5173,http://127.0.0.1:5173"
EXTENSION_REDIRECT_ORIGINS="https://<your-extension-id>.chromiumapp.org"
RESEND_API_KEY="" # Get from Resend
TURNSTILE_SECRET_KEY="" # Get from Cloudflare
GOOGLE_CLIENT_ID="" # Get from Google Cloud Console
GOOGLE_CLIENT_SECRET="" # Get from Google Cloud Console
```

## 3. Backend Environment Variables and Secrets

Set the secrets for the Worker (for Production):

```bash
pnpm exec wrangler secret put BETTER_AUTH_BASE_URL
# e.g. https://api.spinupmail.com/api/auth
pnpm exec wrangler secret put BETTER_AUTH_SECRET
# Run `openssl rand -base64 32` to generate a secret, or you can generate from https://better-auth.com/docs/installation
pnpm exec wrangler secret put INTEGRATION_SECRET_ENCRYPTION_KEY
# Run `openssl rand -base64 32` to generate the required base64 32-byte AES-GCM key used to encrypt integration credentials
pnpm exec wrangler secret put CORS_ORIGIN
# e.g. https://app.spinupmail.com
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
# See detailed Google OAuth setup instructions below
```

Run each of these commands in the `packages/backend` folder and provide the corresponding value when prompted.

Use the Worker URL or your API route URL:

- `BETTER_AUTH_BASE_URL = https://<your-domain>/api/auth`
- `EXTENSION_REDIRECT_ORIGINS = https://<your-extension-id>.chromiumapp.org[,https://<your-firefox-extension-id>.extensions.allizom.org]`
- `GOOGLE_CLIENT_ID = <google oauth web client id>`
- `GOOGLE_CLIENT_SECRET = <google oauth web client secret>`
- `INTEGRATION_SECRET_ENCRYPTION_KEY = <base64 32-byte key; generate with openssl rand -base64 32>` (used to encrypt integration credentials)
- `RESEND_API_KEY = re_...`
- `TURNSTILE_SECRET_KEY = <Cloudflare Turnstile secret key>`
- `RESEND_FROM_EMAIL` should be configured in `wrangler.toml` `[vars]` with a verified sender/domain.

### Creating Turnstile Key

1. Open Cloudflare dashboard and select your account.
2. Use dashboard search and open **Turnstile**.
3. Click **Add widget**.
4. Fill widget configuration:
   - **Widget name**: `Spinupmail` (or any name).
   - **Hostname management**: add your frontend hostname(s), for example:
     - `localhost` (for local frontend)
     - `127.0.0.1` (optional, for local frontend)
     - `your-frontend-domain.com` (production)
   - **Widget mode**: **Managed**.
5. Click **Create**.
6. Copy generated keys:
   - **Site key** (public key)
   - **Secret key** (private key)
7. Set backend secret (Worker):

```bash
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
```

8. Set frontend env:
   - Cloudflare Pages env var: `VITE_TURNSTILE_SITE_KEY=<your site key>`
   - Local dev (`packages/frontend/.env`): `VITE_TURNSTILE_SITE_KEY=<your site key>`

Notes:

- Use the **secret key** only on backend/Worker side (`TURNSTILE_SECRET_KEY`).
- Use the **site key** only in frontend (`VITE_TURNSTILE_SITE_KEY`).
- If Turnstile validation fails in production, confirm your deployed frontend hostname is listed in the widget hostnames.

### Add Domain to Resend and Get API Key

Spinupmail uses Resend for verification and password-reset emails sent by Better Auth.

1. Create or sign in to your Resend account:
   - Open `https://resend.com/`
2. Add your sending domain in Resend:
   - Go to **Domains** -> **Add Domain**
   - Enter your domain
3. Add required DNS records in Cloudflare DNS:
   - Click on Auto Configure button to get redirected to Cloudflare.
   - Save the records on Cloudflare.
4. Wait for domain verification in Resend:
   - In Resend **Domains**, click **Verify DNS Records** (or wait for auto-check)
   - Continue only after status becomes **Verified**
5. Create a Resend API key:
   - Go to **API Keys** -> **Create API Key**
   - Create a new API Key here with a permission to send emails.
   - Copy the generated key (`re_...`)
6. Save API key to backend Worker secret:

```bash
pnpm exec wrangler secret put RESEND_API_KEY
```

7. Configure sender in `packages/backend/wrangler.toml`:
   - Set `[vars].RESEND_FROM_EMAIL` to a verified sender on your Resend domain, for example:
   - `Spinupmail <verify@mail.your-domain.com>`
8. Local development:
   - Add `RESEND_API_KEY=...` in `packages/backend/.dev.vars`

Notes:

- `RESEND_API_KEY` is a backend secret only; do not expose it in frontend env vars.
- The email in `RESEND_FROM_EMAIL` must belong to a verified Resend domain, otherwise mail sending will fail.

### Google OAuth Setup (Sign in / Sign up with Google)

Spinupmail uses Better Auth social login with Google OAuth.

1. Create a Google Cloud project:
   - Open Google Cloud Console: `https://console.cloud.google.com/`
   - Select or create a project.
2. Configure OAuth consent screen:
   - Go to **APIs & Services** -> **OAuth consent screen**
   - Click **Get Started** button
   - Fill **App Name**, this will be shown to users during Google sign-in.
   - Choose a User support email
   - Choose **External** user type in Audience selection step
   - Fill contact email and save
   - On the opened page, click **Create OAuth client**
3. Create OAuth client credentials:
   - On the opened page, click **Create OAuth client**
   - Application type: **Web application**
   - Name: `Spinupmail Auth` (or any name you want)
4. Add authorized JavaScript Origins:
   - `http://127.0.0.1:5173`
   - `http://localhost:5173`
   - `https://<your-frontend-domain>.com` (or your production frontend domain)

5. Add authorized redirect URI(s):
   - Local backend:
     - `http://localhost:8787/api/auth/callback/google`
   - Production backend (pick the one you deploy):
     - `https://<your-api-domain>/api/auth/callback/google` **Preferred**
     - or `https://<your-frontend-domain>/api/auth/callback/google` (if Worker is routed on the frontend domain under `/api/*`)
6. Copy values:
   - `Client ID` -> `GOOGLE_CLIENT_ID`
   - `Client secret` -> `GOOGLE_CLIENT_SECRET`
7. Save credentials to Worker secrets:

```bash
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
```

Local development with `wrangler dev`:

- You should also place these in `packages/backend/.dev.vars`:
  - `GOOGLE_CLIENT_ID=...`
  - `GOOGLE_CLIENT_SECRET=...`

Important:

- `CORS_ORIGIN` must include your frontend origin(s) (for example `http://localhost:5173` and your production app origin), because Better Auth validates callback URLs against trusted origins.
- `EXTENSION_REDIRECT_ORIGINS` must list the exact extension redirect origins you trust for `browser.identity.launchWebAuthFlow`; wildcard `*.chromiumapp.org` or `*.extensions.allizom.org` entries are intentionally not supported.
- Frontend does not need separate Google env vars for this OAuth redirect flow.
- If you set `AUTH_ALLOWED_EMAIL_DOMAIN`, Spinupmail will reject email/password sign-up and sign-in outside that domain and will pass the same domain to Google OAuth using the hosted-domain hint (`hd`).

### Setting Up Integrations (Telegram)

Spinupmail includes an integrations platform for routing inbound email events to
external notification channels. Telegram is currently supported.

1. Create a Telegram bot:
   - Open Telegram and chat with `@BotFather`
   - Run `/newbot` and follow the prompts
   - Save the generated bot token
2. Collect your target chat ID:
   - Send a message to your bot (or add it to a group/channel)
   - Open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Copy the chat id from the updates response
3. Ensure `INTEGRATION_SECRET_ENCRYPTION_KEY` is configured in Worker secrets.
4. Create a Telegram integration from your organization settings or integrations
   API endpoints.
5. Attach integration subscriptions to addresses so `email.received` events are
   dispatched to Telegram.

Current event support:

- `email.received`

Integrations are dispatched asynchronously through the integration queue with
retry/backoff controls from `INTEGRATION_QUEUE_*` vars.

## 4. Database Migrations

Do **not** hand-edit migrations.

```bash
pnpm -C packages/backend db:generate
pnpm -C packages/backend db:migrate:dev
# for production, run `pnpm -C packages/backend db:migrate:prod`
```

### Bootstrap the first platform admin

Spinupmail does not auto-promote the first user and does not use env-based admin
IDs. After migrations have added the Better Auth admin fields, promote the first
admin directly in D1:

```bash
pnpm -C packages/backend exec wrangler d1 execute SUM_DB --local --command "UPDATE users SET role = 'admin' WHERE email = 'you@example.com';"
```

For production, run the same statement with `--remote` after confirming the
target user has signed up and verified their email.

## 5. Deploy the Backend Worker

```bash
pnpm -C packages/backend deploy
```

To setup automatic deployments:

1. Open Build -> Compute -> Workers&Pages section in Cloudflare dashboard
2. Click on your Worker (e.g. `spinupmail`)
3. Open **Settings** tab
4. Under **Build** -> **Git Repository** section, Click **Connect**
5. Choose the repository (you should fork this repo to your Github account first)
6. You can uncheck **Builds for non-production branches**
7. Leave **Build command** empty
8. Fill **Deploy command** with `pnpm run deploy`
9. Fill **Root directory** with `packages/backend`
10. You can enable Build Cache if you want
11. Click **Connect**

## 6. Configure Email Routing (Cloudflare Dashboard)

1. Open Build -> Email Service -> Email Routing in Cloudflare dashboard
2. Click on **Onboard Domain**
3. Select correct **zone** and click **Done**
4. Open the added domain in the list
5. Open **Routing Rules** tab and create a Catch-all rule:
   - Custom Address: Catch All
   - Action: **Send to a worker**
   - Destination: your deployed worker (e.g. `spinupmail`)

If you use multiple domains, repeat the routing rule for each domain you add to
`EMAIL_DOMAINS` and add the domains in the `EMAIL_DOMAINS` variable in `wrangler.toml` as comma separated values.

## 7. Configure Custom Domain for Worker API

1. Open Build -> Compute -> Workers&Pages section in Cloudflare dashboard
2. Click on your deployed Worker (e.g. `spinupmail`)
3. Open **Settings** tab
4. In the **Domains & Routes** section, click **Add**
5. Choose **Custom domain**
6. Enter your API domain (e.g. `api.spinupmail.com`). If everything is OK, a DNS preview will show up. Click **Add domain**.

### 1) Worker config

In `packages/backend/wrangler.toml`:

```
[vars]
EMAIL_DOMAINS = "spinupmail.com,spinupmail.dev"
FORCED_MAIL_PREFIX = "temp" # Optional. Forces created/renamed inboxes to start with temp-
AUTH_ALLOWED_EMAIL_DOMAIN = "example.com" # Optional if you want to restrict sign-ups/sign-ins to a domain
MAX_ADDRESSES_PER_ORGANIZATION = "100"
MAX_RECEIVED_EMAILS_PER_ORGANIZATION = "1000"
MAX_RECEIVED_EMAILS_PER_ADDRESS = "100"
API_KEY_RATE_LIMIT_WINDOW = "60"
API_KEY_RATE_LIMIT_MAX = "120"
AUTH_RATE_LIMIT_WINDOW = "60"
AUTH_RATE_LIMIT_MAX = "100"
AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW = "3600"
AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX = "2"
MAX_INTEGRATIONS_PER_ORGANIZATION = "3"
MAX_INTEGRATION_DISPATCHES_PER_ORGANIZATION_PER_DAY = "100"
INTEGRATION_QUEUE_RETRY_WINDOW_SECONDS = "21600"
INTEGRATION_QUEUE_BASE_DELAY_SECONDS = "30"
INTEGRATION_QUEUE_MAX_DELAY_SECONDS = "1800"
INTEGRATION_QUEUE_JITTER_SECONDS = "10"
EMAIL_ATTACHMENTS_ENABLED = "true"
EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION = "104857600"
```

### 2) UI behavior

When multiple domains are configured, the UI shows a **domain selector** during
address creation. If only one domain is configured, it is used automatically.

If `FORCED_MAIL_PREFIX` is configured, the UI also shows the enforced prefix in
the create/edit username field, but the backend remains the source of truth:
every created or renamed address is normalized to start with
`<FORCED_MAIL_PREFIX>-`, even if a client tries to bypass the UI.

## 8. Deploy the Frontend (Cloudflare Pages)

Create a **Pages** project (not a Worker). The UI can be confusing, explicitly choose "Pages".

1. Open Build -> Compute -> Workers&Pages section in Cloudflare dashboard
2. Click on **Looking to deploy Pages? Get started** link at the bottom
3. Make sure to fork this repository to you Github account
4. Click on **Import an existing Git repository**
5. Connect your Github account and select the forked repository
6. In **Set up builds and deployments**:

- Project name: e.g. `spinupmail`
- Framework preset: **None**
- Build command: `pnpm run build`
- Build output directory: `dist`
- Root directory -> Path: `packages/frontend`
- Environment variables:
  - VITE_AUTH_BASE_URL -> e.g. `https://api.spinupmail.com/api/auth`
  - VITE_API_BASE_URL -> e.g. `https://api.spinupmail.com`
  - VITE_TURNSTILE_SITE_KEY -> your Cloudflare Turnstile site key

### Local Environment Variables

Create `.env` file for frontend development in `packages/frontend`:

```env
VITE_AUTH_BASE_URL=http://localhost:8787/api/auth
VITE_API_BASE_URL=http://localhost:8787
VITE_TURNSTILE_SITE_KEY=<Your Site Key>
```

## 9. Setting up Custom Domain

After the Pages deployment is successful, set up a custom domain for the frontend:

1. Open **Custom domains** tab in your Pages project dashboard
2. Click **Set up a custom domain**
3. Enter your domain (e.g. `app.spinupmail.com`) and click **Continue**
4. Check the DNS record and click **Activate domain**
5. Wait for the domain to be active (can take a few minutes)

## API Usage (Automation)

Generate an API key from the UI. Then use it to access the API:

- API key requests must include `X-Org-Id` with an organization the API key
  owner belongs to.
- Session-cookie requests use the active organization from the user session.

Or use the SDK:

```bash
pnpm install spinupmail
```

```ts
import { SpinupMail } from "spinupmail";

const spinupmail = new SpinupMail();

const address = await spinupmail.addresses.create({
  localPart: "signup-flow",
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

`new SpinupMail()` reads:

- `SPINUPMAIL_API_KEY`
- `SPINUPMAIL_BASE_URL` or `https://api.spinupmail.com`
- `SPINUPMAIL_ORGANIZATION_ID` or `SPINUPMAIL_ORG_ID`

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

Use `after` with local filters to wait for a specific email after a specific timestamp:

```ts
const startedAt = new Date();

const email = await spinupmail.inboxes.waitForEmail({
  addressId: address.id,
  after: startedAt,
  subjectIncludes: "verify",
  bodyIncludes: "654321",
  timeoutMs: 30_000,
});

console.log(email.text);
```

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
- `EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION`: max total attachment storage across all emails in one organization (default `104857600`, or 100 MB).
- `EMAIL_ATTACHMENTS_ENABLED`: when `false`, inbound attachments are ignored and attachment UI/API surfaces are disabled (`true` by default).
- `MAX_RECEIVED_EMAILS_PER_ORGANIZATION`: hard cap across all stored emails in one organization (default `1000`).
- `MAX_RECEIVED_EMAILS_PER_ADDRESS`: hard cap across stored emails in one address (default `100`).
- `OPERATIONAL_EVENT_RETENTION_DAYS`: operational event rows older than this are pruned by the scheduled Worker (default `30`).
- `OPERATIONAL_EVENT_MAX_METADATA_BYTES`: serialized metadata cap per operational event row (default `4096`).
- `OPERATIONAL_EVENT_NOISY_RATE_LIMIT_WINDOW_SECONDS` / `OPERATIONAL_EVENT_NOISY_RATE_LIMIT_MAX`: cap repeated low-value inbound operational events such as rejects, duplicates, limit hits, and abuse blocks (default `1` stored event per `300` seconds per normalized event identity).
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
Message-ID: <MAKE-THIS-UNIQUE-6114391943504294873000@ZSH-GHOSTTY>

Hi there'
```

**Make sure** to set a unique Message-ID for each test email.

To receive **real** emails, use a real domain in Cloudflare Email Routing (you
can create a dev subdomain like `dev.your-domain.com`) and point the routing
rule to your Worker.

## Versioning and Releases

SpinupMail uses two separate release tracks:

- Repo releases use tags like `v0.1.0` and represent self-hosted SpinupMail
  releases published on GitHub.
- SDK releases use tags like `sdk-v0.1.1` and publish the public
  `spinupmail` npm package from `packages/sdk`.

This separation keeps repo releases and npm publishes independent. Creating a
repo tag like `v0.1.0` will not publish the SDK. Creating an SDK tag like
`sdk-v0.1.1` will not create a product release by itself.

Before creating a release tag, make sure `main` is green in GitHub Actions. For
a full local pre-release pass, run:

```bash
pnpm run test:ci
```

### Repo Releases

Use repo tags for SpinupMail product releases:

```bash
git tag -a v0.1.0 -m "SpinupMail v0.1.0"
git push origin v0.1.0
```

After pushing the tag, create a GitHub Release for that version and summarize
the notable changes from `CHANGELOG.md`.

### SDK Releases

Use SDK tags for npm publishes:

1. Update `packages/sdk/package.json` to the new SDK version.
2. Make sure the SDK release checks pass:

```bash
pnpm -C packages/sdk typecheck
pnpm -C packages/sdk test
pnpm -C packages/sdk build
pnpm -C packages/sdk test:package
```

3. Create and push the SDK tag:

```bash
git tag -a sdk-v0.1.1 -m "spinupmail SDK v0.1.1"
git push origin sdk-v0.1.1
```

The GitHub Actions workflow in `.github/workflows/publish-sdk.yml` will verify
that the tag matches `packages/sdk/package.json` and then publish the package
to npm using trusted publishing.
