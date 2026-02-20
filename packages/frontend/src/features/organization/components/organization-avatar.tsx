import BoringAvatar from "boring-avatars";
import { useTheme } from "@/components/theme-provider";
import { getAvatarColors } from "@/lib/avatar-colors";
import { cn } from "@/lib/utils";

type OrganizationAvatarProps = {
  organizationId: string;
  organizationName?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
};

const SIZE_CLASS_MAP = {
  sm: "size-6",
  default: "size-8",
  lg: "size-10",
} as const;

export const OrganizationAvatar = ({
  organizationId,
  organizationName: _organizationName,
  size = "default",
  className,
}: OrganizationAvatarProps) => {
  const { theme } = useTheme();
  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme =
    theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  const colors = getAvatarColors(organizationId, resolvedTheme);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border/70 leading-none [&>svg]:block! [&>svg]:size-full!",
        SIZE_CLASS_MAP[size],
        className
      )}
      aria-hidden="true"
    >
      <BoringAvatar
        size="100%"
        name={organizationId}
        variant="bauhaus"
        colors={colors}
        className="block! size-full!"
        square
      />
    </div>
  );
};
