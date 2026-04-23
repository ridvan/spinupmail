import { HugeiconsIcon } from "@hugeicons/react";
import {
  AddressBookIcon,
  Alert02Icon,
  ArrowUpRight01Icon,
  BookOpen01Icon,
  ComputerIcon,
  ConnectIcon,
  DatabaseIcon,
  LayoutIcon,
  Mail01Icon,
  Mailbox01Icon,
  Rocket01Icon,
  ShieldIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { CloudflareCloudIcon } from "@/components/icons/cloudflare-cloud-icon";
import { cn } from "@/lib/utils";

const groupIconById = {
  "get-started": Rocket01Icon,
  "api-reference": DatabaseIcon,
  configuration: ShieldIcon,
  operations: Mail01Icon,
} as const;

const pageIconBySlug = {
  installation: Rocket01Icon,
  "api-overview": BookOpen01Icon,
  "api-domains": DatabaseIcon,
  "api-organizations": UserMultiple02Icon,
  "api-email-addresses": AddressBookIcon,
  "api-emails": Mailbox01Icon,
  "auth-secrets": ShieldIcon,
  "deploy-routing": ArrowUpRight01Icon,
  "inbound-pipeline": Mail01Icon,
  integrations: ConnectIcon,
  "multi-domain": LayoutIcon,
  "local-development": ComputerIcon,
  "limits-security": Alert02Icon,
} as const;

export function DocsGroupIcon({
  groupId,
  className,
  strokeWidth = 1.8,
}: {
  groupId: keyof typeof groupIconById;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <HugeiconsIcon
      icon={groupIconById[groupId]}
      className={className}
      strokeWidth={strokeWidth}
    />
  );
}

export function DocsPageIcon({
  slug,
  className,
  strokeWidth = 1.8,
}: {
  slug: string;
  className?: string;
  strokeWidth?: number;
}) {
  if (slug === "cloudflare-resources") {
    return <CloudflareCloudIcon className={cn("shrink-0", className)} />;
  }

  if (!(slug in pageIconBySlug)) {
    return null;
  }

  const icon = pageIconBySlug[slug as keyof typeof pageIconBySlug];

  return (
    <HugeiconsIcon
      icon={icon}
      className={className}
      strokeWidth={strokeWidth}
    />
  );
}
