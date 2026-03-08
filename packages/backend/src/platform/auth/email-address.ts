const BASIC_EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)(?:[a-z0-9_+-]+(?:\.[a-z0-9_+-]+)*)@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const DOMAIN_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

const parseEmailParts = (value: string) => {
  const email = value.trim().toLowerCase();
  if (!email || !BASIC_EMAIL_PATTERN.test(email)) return null;
  if (email.includes("..")) return null;

  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === email.length - 1) return null;

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (!local || !domain || !DOMAIN_PATTERN.test(domain)) {
    return null;
  }

  return { email, local, domain };
};

export const normalizeDomain = (value: string) =>
  value.trim().toLowerCase().replace(/^@+/, "").replace(/\.+$/, "");

export const isDomainLike = (value: string) => DOMAIN_PATTERN.test(value);

export const normalizeEmailAddress = (value: string) => {
  const parsed = parseEmailParts(value);
  if (!parsed) return null;

  let { local } = parsed;
  let { domain } = parsed;

  if (domain === "googlemail.com") {
    domain = "gmail.com";
  }

  if (domain === "gmail.com") {
    const plusIndex = local.indexOf("+");
    if (plusIndex >= 0) {
      local = local.slice(0, plusIndex);
    }
    local = local.replace(/\./g, "");
  }

  return `${local}@${domain}`;
};

export const getEmailDomain = (value: string) => {
  const normalizedEmail = normalizeEmailAddress(value);
  if (!normalizedEmail) return null;
  return normalizedEmail.slice(normalizedEmail.lastIndexOf("@") + 1);
};
