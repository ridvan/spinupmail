import { getDb } from "@/platform/db/client";
import {
  getAllowedDomains,
  getMaxAddressesPerOrganization,
} from "@/shared/env";
import { isAddressConflictError } from "@/shared/errors";
import {
  hasReservedLocalPartKeyword,
  normalizeAddress,
} from "@/shared/validation";
import {
  findAutoCreatedAddressByOrganization,
  insertAddress,
} from "@/modules/email-addresses/repo";
import {
  insertInboundEmail,
  listSampleEmailsForAddress,
  updateAddressLastReceivedAt,
} from "@/modules/inbound-email/repo";

const LOCAL_PART_MAX_ATTEMPTS = 24;
const ADJECTIVES = [
  "amber",
  "brisk",
  "calm",
  "bright",
  "eager",
  "lucky",
  "rapid",
  "steady",
];
const NOUNS = [
  "harbor",
  "inbox",
  "lantern",
  "meadow",
  "orbit",
  "river",
  "signal",
  "spark",
];

const SAMPLE_SENDER = "Spinupmail Team <hello@spinupmail.app>";
const SAMPLE_FROM = "hello@spinupmail.app";
const STARTER_EMAIL_BG_COLOR = "#f3efe8";
const STARTER_EMAIL_SURFACE_COLOR = "#fffdf9";
const STARTER_EMAIL_PANEL_COLOR = "#f7f3ec";
const STARTER_EMAIL_BORDER_COLOR = "#e6ddd1";
const STARTER_EMAIL_TEXT_COLOR = "#171717";
const STARTER_EMAIL_MUTED_COLOR = "#5f5a52";
const STARTER_EMAIL_BADGE_BG_COLOR = "#171717";
const STARTER_EMAIL_BADGE_TEXT_COLOR = "#f8f5ef";
const STARTER_EMAIL_PILL_BG_COLOR = "#f0ebe3";
const STARTER_EMAIL_PILL_TEXT_COLOR = "#2b2824";
const STARTER_EMAIL_FOOTER_COLOR = "#787168";
const STARTER_EMAIL_DARK_BG_COLOR = "#12100d";
const STARTER_EMAIL_DARK_SURFACE_COLOR = "#191612";
const STARTER_EMAIL_DARK_PANEL_COLOR = "#211d18";
const STARTER_EMAIL_DARK_BORDER_COLOR = "#322c25";
const STARTER_EMAIL_DARK_TEXT_COLOR = "#f5f1ea";
const STARTER_EMAIL_DARK_MUTED_COLOR = "#b7aea2";
const STARTER_EMAIL_DARK_BADGE_BG_COLOR = "#f5f1ea";
const STARTER_EMAIL_DARK_BADGE_TEXT_COLOR = "#171717";
const STARTER_EMAIL_DARK_PILL_BG_COLOR = "#2b251f";
const STARTER_EMAIL_DARK_FOOTER_COLOR = "#978e82";
const RAW_TEXT_ENCODER = new TextEncoder();

/**
 * Escape plain-text values before embedding them into HTML templates.
 * This is for values like organization names or email addresses, not rich or
 * untrusted HTML input. Keep the ampersand replacement first to avoid
 * double-escaping later replacements.
 *
 * Example: escapeHtml('Acme & <QA>') => 'Acme &amp; &lt;QA&gt;'
 */
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildRandomSuffix = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 3);

const buildStarterLocalPart = () => {
  const adjective =
    ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] ?? "starter";
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)] ?? "inbox";
  return `${adjective}-${noun}-${buildRandomSuffix()}`;
};

const buildStarterEmailHeader = ({
  preheader,
  title,
  intro,
}: {
  preheader: string;
  title: string;
  intro: string;
}) =>
  [
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">',
    `  ${escapeHtml(preheader)}`,
    "</div>",
    `<p class="spinupmail-sample-muted" style="margin:0;font-size:12px;line-height:1;text-transform:uppercase;letter-spacing:0.18em;color:${STARTER_EMAIL_MUTED_COLOR};">Spinupmail starter inbox</p>`,
    `<h1 class="spinupmail-sample-text" style="margin:18px 0 0 0;font-size:34px;line-height:1.1;font-weight:600;letter-spacing:-0.03em;color:${STARTER_EMAIL_TEXT_COLOR};">${escapeHtml(title)}</h1>`,
    `<p class="spinupmail-sample-muted" style="margin:18px 0 0 0;font-size:16px;line-height:1.7;color:${STARTER_EMAIL_MUTED_COLOR};">${escapeHtml(intro)}</p>`,
  ].join("\n");

const buildStarterAddressCard = ({
  label,
  address,
  hint,
}: {
  label: string;
  address: string;
  hint: string;
}) =>
  [
    `<table class="spinupmail-sample-panel" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border:1px solid ${STARTER_EMAIL_BORDER_COLOR};background:${STARTER_EMAIL_PANEL_COLOR};border-radius:24px;">`,
    "  <tr>",
    '    <td style="padding:24px;">',
    `      <p class="spinupmail-sample-muted" style="margin:0;font-size:12px;line-height:1;text-transform:uppercase;letter-spacing:0.16em;color:${STARTER_EMAIL_MUTED_COLOR};">${escapeHtml(label)}</p>`,
    `      <p style="margin:14px 0 0 0;"><span class="spinupmail-sample-pill" style="display:inline-block;padding:12px 16px;border-radius:999px;background:${STARTER_EMAIL_PILL_BG_COLOR};font-size:15px;line-height:1.4;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;color:${STARTER_EMAIL_PILL_TEXT_COLOR};">${escapeHtml(address)}</span></p>`,
    `      <p class="spinupmail-sample-muted" style="margin:16px 0 0 0;font-size:14px;line-height:1.7;color:${STARTER_EMAIL_MUTED_COLOR};">${escapeHtml(hint)}</p>`,
    "    </td>",
    "  </tr>",
    "</table>",
  ].join("\n");

const buildStarterChecklistCard = ({
  title,
  items,
}: {
  title: string;
  items: string[];
}) =>
  [
    `<table class="spinupmail-sample-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;border:1px solid ${STARTER_EMAIL_BORDER_COLOR};background:${STARTER_EMAIL_SURFACE_COLOR};border-radius:24px;">`,
    "  <tr>",
    '    <td style="padding:24px;">',
    `      <p class="spinupmail-sample-text" style="margin:0 0 18px 0;font-size:18px;line-height:1.4;font-weight:600;color:${STARTER_EMAIL_TEXT_COLOR};">${escapeHtml(title)}</p>`,
    '      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">',
    ...items.map(item =>
      [
        "        <tr>",
        '          <td valign="top" style="width:18px;padding:0 0 14px 0;">',
        `            <div class="spinupmail-sample-dot" style="width:8px;height:8px;border-radius:999px;background:${STARTER_EMAIL_TEXT_COLOR};margin-top:8px;"></div>`,
        "          </td>",
        `          <td class="spinupmail-sample-muted" style="padding:0 0 14px 0;font-size:15px;line-height:1.7;color:${STARTER_EMAIL_MUTED_COLOR};">${escapeHtml(item)}</td>`,
        "        </tr>",
      ].join("\n")
    ),
    "      </table>",
    "    </td>",
    "  </tr>",
    "</table>",
  ].join("\n");

const buildStarterStepCards = (
  steps: Array<{
    label: string;
    title: string;
    body: string;
  }>
) =>
  steps
    .map(step =>
      [
        `<table class="spinupmail-sample-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;border:1px solid ${STARTER_EMAIL_BORDER_COLOR};background:${STARTER_EMAIL_SURFACE_COLOR};border-radius:24px;">`,
        "  <tr>",
        '    <td style="padding:22px 24px;">',
        `      <p class="spinupmail-sample-muted" style="margin:0;font-size:12px;line-height:1;text-transform:uppercase;letter-spacing:0.16em;color:${STARTER_EMAIL_MUTED_COLOR};">${escapeHtml(step.label)}</p>`,
        `      <p class="spinupmail-sample-text" style="margin:12px 0 0 0;font-size:18px;line-height:1.45;font-weight:600;color:${STARTER_EMAIL_TEXT_COLOR};">${escapeHtml(step.title)}</p>`,
        `      <p class="spinupmail-sample-muted" style="margin:10px 0 0 0;font-size:15px;line-height:1.7;color:${STARTER_EMAIL_MUTED_COLOR};">${escapeHtml(step.body)}</p>`,
        "    </td>",
        "  </tr>",
        "</table>",
      ].join("\n")
    )
    .join("\n");

const buildStarterEmailHtmlDocument = ({
  preheader,
  title,
  intro,
  sections,
}: {
  preheader: string;
  title: string;
  intro: string;
  sections: string[];
}) =>
  [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '    <meta name="color-scheme" content="light dark" />',
    '    <meta name="supported-color-schemes" content="light dark" />',
    `    <title>${escapeHtml(title)}</title>`,
    "    <style>",
    "      :root {",
    "        color-scheme: light dark;",
    "      }",
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-body,',
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-canvas {',
    `        background:${STARTER_EMAIL_DARK_BG_COLOR} !important;`,
    "      }",
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-shell,',
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-card {',
    `        background:${STARTER_EMAIL_DARK_SURFACE_COLOR} !important;`,
    `        border-color:${STARTER_EMAIL_DARK_BORDER_COLOR} !important;`,
    "      }",
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-panel {',
    `        background:${STARTER_EMAIL_DARK_PANEL_COLOR} !important;`,
    `        border-color:${STARTER_EMAIL_DARK_BORDER_COLOR} !important;`,
    "      }",
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-text {',
    `        color:${STARTER_EMAIL_DARK_TEXT_COLOR} !important;`,
    "      }",
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-muted {',
    `        color:${STARTER_EMAIL_DARK_MUTED_COLOR} !important;`,
    "      }",
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-pill {',
    `        background:${STARTER_EMAIL_DARK_PILL_BG_COLOR} !important;`,
    `        color:${STARTER_EMAIL_DARK_TEXT_COLOR} !important;`,
    "      }",
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-badge {',
    `        background:${STARTER_EMAIL_DARK_BADGE_BG_COLOR} !important;`,
    `        color:${STARTER_EMAIL_DARK_BADGE_TEXT_COLOR} !important;`,
    "      }",
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-dot {',
    `        background:${STARTER_EMAIL_DARK_TEXT_COLOR} !important;`,
    "      }",
    '      [data-spinupmail-theme="dark"] .spinupmail-sample-footer {',
    `        color:${STARTER_EMAIL_DARK_FOOTER_COLOR} !important;`,
    "      }",
    "    </style>",
    "  </head>",
    `  <body class="spinupmail-sample-body" style="margin:0;padding:0;background:${STARTER_EMAIL_BG_COLOR};font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${STARTER_EMAIL_TEXT_COLOR};">`,
    `    <table class="spinupmail-sample-canvas" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${STARTER_EMAIL_BG_COLOR};padding:28px 12px;">`,
    "      <tr>",
    '        <td align="center">',
    `          <table class="spinupmail-sample-shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;border:1px solid ${STARTER_EMAIL_BORDER_COLOR};background:${STARTER_EMAIL_SURFACE_COLOR};border-radius:32px;">`,
    "            <tr>",
    '              <td style="padding:16px 24px 0 24px;">',
    `                <span class="spinupmail-sample-badge" style="display:inline-block;padding:8px 12px;border-radius:999px;background:${STARTER_EMAIL_BADGE_BG_COLOR};font-size:11px;line-height:1;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${STARTER_EMAIL_BADGE_TEXT_COLOR};">Sample email</span>`,
    "              </td>",
    "            </tr>",
    "            <tr>",
    '              <td style="padding:22px 24px 0 24px;">',
    buildStarterEmailHeader({ preheader, title, intro }),
    "              </td>",
    "            </tr>",
    "            <tr>",
    '              <td style="padding:0 24px 24px 24px;">',
    ...sections,
    "              </td>",
    "            </tr>",
    "          </table>",
    `          <p class="spinupmail-sample-footer" style="max-width:560px;margin:18px auto 0 auto;font-size:12px;line-height:1.7;color:${STARTER_EMAIL_FOOTER_COLOR};">Created automatically for your new organization so you can preview how messages look inside Spinupmail.</p>`,
    "        </td>",
    "      </tr>",
    "    </table>",
    "  </body>",
    "</html>",
  ].join("\n");

const buildSampleEmailRaw = ({
  emailId,
  to,
  subject,
  bodyText,
  bodyHtml,
}: {
  emailId: string;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}) => {
  const boundary = `spinupmail-sample-${emailId}`;

  return [
    `From: ${SAMPLE_SENDER}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "X-Spinupmail-Sample: true",
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    bodyText,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    bodyHtml,
    "",
    `--${boundary}--`,
  ].join("\r\n");
};

const buildSampleEmails = ({
  organizationName,
  address,
  now,
}: {
  organizationName: string;
  address: string;
  now: number;
}) => {
  return [
    {
      subject: "Welcome to Spinupmail",
      bodyText: [
        `Welcome to ${organizationName}.`,
        "",
        `Your starter inbox is ready at ${address}.`,
        "Use it to preview how incoming mail is captured, rendered, and organized.",
        "",
        "Try these first:",
        "- Send a message from your own inbox",
        "- Open the rendered preview and raw source",
        "- Create more addresses when you are ready",
      ].join("\n"),
      bodyHtml: buildStarterEmailHtmlDocument({
        preheader: `Your starter inbox for ${organizationName} is ready.`,
        title: `Welcome to ${organizationName}`,
        intro: `Your new inbox is live and waiting at ${address}. Use it to see how messages land, render, and stay organized inside ${organizationName}.`,
        sections: [
          buildStarterAddressCard({
            label: "Starter inbox",
            address,
            hint: "This address was created automatically for your organization and is ready to receive mail now.",
          }),
          buildStarterChecklistCard({
            title: "Start here",
            items: [
              "Send a quick message from your own email account.",
              "Open the rendered preview to inspect HTML safely.",
              "Use the raw source view when you need to debug a message.",
            ],
          }),
        ],
      }),
      receivedAt: new Date(now - 2 * 60 * 1000),
    },
    {
      subject: "Send your first test email",
      bodyText: [
        `Try sending a message to ${address}.`,
        "",
        "That is the fastest way to confirm your routing, inbox list, and preview flow are all working.",
        "",
        "Once it arrives, confirm:",
        "- The inbox list updates",
        "- HTML and plain text previews load",
        "- Sender, subject, and raw source look correct",
      ].join("\n"),
      bodyHtml: buildStarterEmailHtmlDocument({
        preheader: `Send your first test email to ${address}.`,
        title: "Send your first test email",
        intro: `A real message to ${address} is the fastest end-to-end check for your new inbox.`,
        sections: [
          buildStarterAddressCard({
            label: "Send to",
            address,
            hint: "Use any mail provider you already trust. The point is to watch one real message arrive end to end.",
          }),
          buildStarterChecklistCard({
            title: "After it lands, confirm",
            items: [
              "The inbox list updates and keeps the newest email at the top.",
              "Rendered HTML and plain text previews both look right.",
              "Sender details, subject lines, and raw source are preserved cleanly.",
            ],
          }),
        ],
      }),
      receivedAt: new Date(now),
    },
    {
      subject: "What to explore next",
      bodyText: [
        "Next up:",
        "- Create more addresses for different workflows",
        "- Invite teammates into the organization",
        "- Compare preview, text, and raw message views",
      ].join("\n"),
      bodyHtml: buildStarterEmailHtmlDocument({
        preheader: `A few next steps for ${organizationName}.`,
        title: "What to explore next",
        intro:
          "Once the starter inbox feels familiar, a few small setup steps make the workspace more useful for ongoing email work.",
        sections: [
          buildStarterStepCards([
            {
              label: "01",
              title: "Create more addresses",
              body: "Set up dedicated inboxes for signups, QA flows, support replies, or any workflow that deserves its own stream.",
            },
            {
              label: "02",
              title: "Invite teammates",
              body: "Bring collaborators into the organization so everyone can inspect incoming messages without sharing a personal inbox.",
            },
            {
              label: "03",
              title: "Compare every view",
              body: "Use rendered preview, plain text, and raw source together when you need to debug how a message was delivered.",
            },
          ]),
        ],
      }),
      receivedAt: new Date(now - 60 * 1000),
    },
  ];
};

const getRawSize = (raw: string) => RAW_TEXT_ENCODER.encode(raw).length;

const ensureStarterSampleEmails = async ({
  db,
  addressId,
  address,
  organizationName,
  existingSampleEmails,
}: {
  db: ReturnType<typeof getDb>;
  addressId: string;
  address: string;
  organizationName: string;
  existingSampleEmails: Array<{
    subject: string | null;
    receivedAt: Date;
  }>;
}) => {
  const samples = buildSampleEmails({
    organizationName,
    address,
    now: Date.now(),
  });
  const existingSubjects = new Set(
    existingSampleEmails.flatMap(email =>
      typeof email.subject === "string" ? [email.subject] : []
    )
  );
  const missingSamples = samples.filter(
    sample => !existingSubjects.has(sample.subject)
  );

  for (const sample of missingSamples) {
    const emailId = crypto.randomUUID();
    const raw = buildSampleEmailRaw({
      emailId,
      to: address,
      subject: sample.subject,
      bodyText: sample.bodyText,
      bodyHtml: sample.bodyHtml,
    });

    await insertInboundEmail(db, {
      id: emailId,
      addressId,
      messageId: `<${emailId}@spinupmail-sample.local>`,
      sender: SAMPLE_SENDER,
      from: SAMPLE_FROM,
      to: address,
      subject: sample.subject,
      bodyHtml: sample.bodyHtml,
      bodyText: sample.bodyText,
      raw,
      rawSize: getRawSize(raw),
      rawTruncated: false,
      receivedAt: sample.receivedAt,
      countAlreadyReserved: false,
      isSample: true,
    });
  }

  const latestReceivedAt = [
    ...existingSampleEmails,
    ...missingSamples,
  ].reduce<Date | null>(
    (latest, sample) =>
      latest === null || sample.receivedAt.getTime() > latest.getTime()
        ? sample.receivedAt
        : latest,
    null
  );

  if (latestReceivedAt) {
    await updateAddressLastReceivedAt(db, addressId, latestReceivedAt);
  }

  return {
    seededSampleEmailCount: missingSamples.length,
  };
};

type SeedStarterInboxResult = {
  starterAddressId: string;
  starterAddress: string;
  seededSampleEmailCount: number;
  createdStarterAddress: boolean;
};

export const seedStarterInbox = async ({
  env,
  organizationId,
  userId,
  organizationName,
}: {
  env: CloudflareBindings;
  organizationId: string;
  userId: string;
  organizationName: string;
}): Promise<SeedStarterInboxResult> => {
  const allowedDomains = getAllowedDomains(env);
  const defaultDomain = allowedDomains[0];
  if (!defaultDomain) {
    throw new Error("EMAIL_DOMAINS is not configured");
  }

  const db = getDb(env);
  const existingStarter = await findAutoCreatedAddressByOrganization(
    db,
    organizationId
  );

  if (existingStarter) {
    const existingSampleEmails = await listSampleEmailsForAddress(
      db,
      existingStarter.id
    );
    const { seededSampleEmailCount } = await ensureStarterSampleEmails({
      db,
      addressId: existingStarter.id,
      address: existingStarter.address,
      organizationName,
      existingSampleEmails,
    });

    return {
      starterAddressId: existingStarter.id,
      starterAddress: existingStarter.address,
      seededSampleEmailCount,
      createdStarterAddress: false,
    };
  }

  const addressLimit = getMaxAddressesPerOrganization(env);
  let starterAddress:
    | {
        id: string;
        address: string;
      }
    | undefined;

  for (let attempt = 0; attempt < LOCAL_PART_MAX_ATTEMPTS; attempt += 1) {
    const localPart = buildStarterLocalPart();
    if (hasReservedLocalPartKeyword(localPart)) continue;

    const id = crypto.randomUUID();
    const address = normalizeAddress(`${localPart}@${defaultDomain}`);

    try {
      const inserted = await insertAddress(
        db,
        {
          id,
          organizationId,
          userId,
          address,
          localPart,
          domain: defaultDomain,
          autoCreated: true,
        },
        addressLimit
      );

      if (!inserted) {
        throw new Error(
          `Address limit reached. Each organization can create up to ${addressLimit} addresses.`
        );
      }

      starterAddress = { id, address };
      break;
    } catch (error) {
      if (!isAddressConflictError(error)) {
        throw error;
      }
    }
  }

  if (!starterAddress) {
    throw new Error("Unable to create starter inbox address");
  }

  const { seededSampleEmailCount } = await ensureStarterSampleEmails({
    db,
    addressId: starterAddress.id,
    address: starterAddress.address,
    organizationName,
    existingSampleEmails: [],
  });

  return {
    starterAddressId: starterAddress.id,
    starterAddress: starterAddress.address,
    seededSampleEmailCount,
    createdStarterAddress: true,
  };
};
