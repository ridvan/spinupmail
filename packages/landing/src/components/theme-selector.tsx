import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "src/lib/utils";
import type { LandingTheme } from "@/lib/theme-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useLandingTheme } from "@/lib/theme-store";

type ThemeSelectorProps = {
  chromeless?: boolean;
  mobile?: boolean;
};

const options: Array<{
  icon: typeof Sun03Icon;
  label: string;
  value: LandingTheme;
}> = [
  { icon: Sun03Icon, label: "Light", value: "light" },
  { icon: Moon02Icon, label: "Dark", value: "dark" },
  { icon: ComputerIcon, label: "System", value: "system" },
];

export function ThemeSelector({
  chromeless = false,
  mobile = false,
}: ThemeSelectorProps) {
  const { setTheme, theme } = useLandingTheme();

  const activeOption =
    options.find(option => option.value === theme) ?? options[2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={chromeless ? "ghost" : "outline"}
            size={chromeless ? "icon" : "sm"}
            className={cn(
              "cursor-pointer",
              chromeless
                ? "border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground aria-expanded:bg-transparent dark:hover:bg-transparent"
                : mobile
                  ? "size-8 p-0"
                  : "aspect-square px-0"
            )}
            aria-label="Theme options"
          />
        }
      >
        <HugeiconsIcon
          icon={activeOption.icon}
          className="size-4"
          strokeWidth={1.8}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-28">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={value => setTheme(value as LandingTheme)}
        >
          {options.map(option => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="gap-2"
            >
              <HugeiconsIcon
                icon={option.icon}
                className="size-4"
                strokeWidth={1.8}
              />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
