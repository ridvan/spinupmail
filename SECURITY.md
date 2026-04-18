# Security Policy

Thanks for helping keep SpinupMail and SpinupMail-based deployments safe.

SpinupMail is a self-hosted temporary email platform built on Cloudflare
Workers, Better Auth, D1, KV, and R2. This policy explains how to report
security issues in the project and what kind of handling to expect.

## Supported Versions

Security fixes are only guaranteed for the newest supported code line.

| Version                          | Supported |
| -------------------------------- | --------- |
| `main`                           | Yes       |
| Older commits                    | No        |
| Forks and downstream deployments | No        |

If possible, reproduce the issue on current `main` before reporting it.

## Reporting a Vulnerability

Please report vulnerabilities privately through GitHub Private Vulnerability
Reporting in the SpinupMail repository Security tab:

<https://github.com/ridvan/spinupmail/security>

Do not open a public GitHub issue, discussion, or pull request for a security
report.

Include as much of the following as you can:

- A short summary of the issue and why it matters
- The affected area, such as `packages/backend`, `packages/frontend`,
  `packages/extension`, `packages/sdk`, or deployment/docs
- The version, tag, commit, or branch you tested
- Clear reproduction steps or a minimal proof of concept
- The security impact you expect, such as auth bypass, org data exposure, inbox
  access, raw email leakage, attachment access, or secret exposure
- Any logs, screenshots, request samples, or stack traces that help, with
  secrets and personal data redacted
- Whether the issue affects the open-source project itself, a specific
  self-hosted deployment, or both

## Response Targets

The current targets are:

- Acknowledgement within 3 business days
- Initial triage within 7 business days
- Follow-up updates as the investigation progresses

Complex issues, dependency-coordination work, and fixes that need rollout
planning may take longer, but reports should not go silent.

## Scope

This policy covers security issues in this repository, including:

- The backend Worker API, auth flows, org scoping, API key handling, inbound
  email processing, and attachment or raw-message retrieval
- The frontend dashboard and extension flows that affect authentication,
  authorization, or sensitive data exposure
- The SDK when it causes security-relevant behavior in SpinupMail integrations
- Deployment and configuration guidance in this repo when it can directly lead
  to an insecure default or unsafe operator setup

Out of scope for this repository:

- Vulnerabilities caused only by a private deployment's local misconfiguration
- Problems that require access you do not already have
- Social engineering, phishing, or physical attacks
- Denial-of-service testing, spam campaigns, or inbox flooding against shared
  infrastructure
- Reports against third-party services unless the issue is in how SpinupMail
  integrates with them

If you are reporting a bug in a hosted deployment operated by someone else,
contact that deployment operator as well when appropriate.

## Testing Expectations

Please keep testing controlled and proportional:

- Use accounts, domains, inboxes, API keys, and environments you own or are
  explicitly authorized to test
- Avoid reading, changing, deleting, or retaining data that does not belong to
  you
- Stop once you have enough evidence to demonstrate the issue
- Do not intentionally exfiltrate attachments, raw messages, secrets, or user
  data
- Do not degrade service availability for other users

If you accidentally access sensitive data, stop immediately and include that in
your report.

## Self-Hosted Deployments

SpinupMail is self-hosted, so some security issues belong to the deployment
operator rather than the upstream codebase.

When reporting, it helps to say whether the issue appears to come from:

- A bug in SpinupMail itself
- An outdated deployment
- A configuration mistake, such as exposed secrets, overly broad trusted
  origins, unsafe raw-email retention, or weak rate-limit settings

If the issue is deployment-specific, we still want the report when the repo's
defaults, docs, or validation should be improved.

## Disclosure

Please give us reasonable time to investigate, fix, and coordinate release of a
patch before public disclosure.

After a fix is available, coordinated public write-ups are welcome.
