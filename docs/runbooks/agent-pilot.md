# Controlled agent outbound pilot

The code is not authorization to enable hosted outbound email. Production
configuration must stay off until every gate below has dated evidence and an
accountable owner.

## Launch gates

| Gate            | Required evidence                                                                                                                               | Current status                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Provider        | Workers Paid, operator-owned sending domain, arbitrary-recipient eligibility, account quota, and real delivery/deferred/bounce/complaint events | Unavailable; public documentation is not account approval |
| Abuse and legal | Transactional-use policy, recipient-consent rule, reporting, suspension/appeal, retention/deletion, and incident owner                          | Unavailable; requires product/operator review             |
| Billing         | Signed Stripe webhooks, entitlement reconciliation, dispute/refund and tax decisions                                                            | Unavailable; Stripe is excluded from this change          |
| Pricing         | At least 100 paid workspace-months or three months of measured provider, compute, storage, support, fraud, bounce, complaint, and payment costs | Unavailable; USD 5 remains a private hypothesis           |
| Deployment      | Reviewed migrations, secrets, queues, observability, backups, rollback, and a successful isolated recovery drill                                | Unavailable until deployment review                       |
| Security        | Credential hashing and scopes, tenant/file isolation, idempotency races, content handling, uncertain delivery, and MCP exclusions reviewed      | Pending code review                                       |

## Pilot setup

1. Use a non-production Cloudflare account or isolated Worker and an
   operator-owned transactional sending domain.
2. Apply migrations and configure D1/R2. Create separate agent event and outbound
   queues with dead-letter queues.
3. Set `AGENT_PROVIDER_EVENT_SECRET` as a Worker secret. Never put it in
   `wrangler.toml`.
4. Keep `AGENT_OUTBOUND_ENABLED="false"`. Assign one manual pilot entitlement,
   exact recipient rules, and a conservative recipient limit directly through
   an operator-reviewed administrative process.
5. Verify the Agent Mail dashboard reports the expected workspace, 2FA,
   entitlement, domain, usage, suspension, and fleet states.
6. Enable the workspace and fleet switches while the environment flag remains
   false. Confirm submission is still blocked.
7. Enable the environment flag only for the isolated outbound worker and test
   one consenting recipient.

## Provider proof

Send one allowed transactional reply, then use provider-supported test paths for
a known bounce and complaint-equivalent signal. Confirm:

- one provider submission per stable submission ID;
- delivered/deferred/bounce/complaint events reconcile once per recipient;
- late events do not regress a terminal state;
- suppression prevents a later send;
- an `uncertain` call is visible and is not automatically retried;
- the workspace suspends under the conservative complaint/bounce defaults; and
- the fleet kill switch prevents further provider transmission immediately.

Do not simulate proof by manually editing delivery rows. Retain redacted provider
IDs, timestamps, and screenshots or logs that omit addresses and content.

## Stop conditions

Disable the fleet switch and environment flag immediately for unexplained
duplicates, cross-tenant access, unexpected recipients, rising complaints,
provider quota warnings, missing event reconciliation, or an inability to prove
the result of a provider call. Follow
[Agent inbox recovery](agent-recovery.md) before resuming.
