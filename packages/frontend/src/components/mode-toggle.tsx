import { Button } from "@/components/ui/button";
import {
  ContrastIcon,
  type ContrastIconHandle,
} from "@/components/ui/contrast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoonIcon, type MoonIconHandle } from "@/components/ui/moon";
import { SunIcon, type SunIconHandle } from "@/components/ui/sun";
import { useTheme } from "@/components/theme-provider";
import { useCallback, useRef } from "react";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  const triggerSunRef = useRef<SunIconHandle>(null);
  const triggerMoonRef = useRef<MoonIconHandle>(null);
  const triggerContrastRef = useRef<ContrastIconHandle>(null);

  const getActiveTriggerRef = useCallback(() => {
    if (theme === "light") return triggerSunRef;
    if (theme === "dark") return triggerMoonRef;
    return triggerContrastRef;
  }, [theme]);

  const startTriggerAnimation = useCallback(() => {
    getActiveTriggerRef().current?.startAnimation();
  }, [getActiveTriggerRef]);

  const stopTriggerAnimation = useCallback(() => {
    getActiveTriggerRef().current?.stopAnimation();
  }, [getActiveTriggerRef]);

  return (
    <DropdownMenu
      onOpenChange={isOpen => {
        if (isOpen) startTriggerAnimation();
        else stopTriggerAnimation();
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="cursor-pointer border-border/50 bg-transparent hover:border-border/60 dark:border-input/50 dark:hover:border-input/60"
            onMouseEnter={startTriggerAnimation}
            onMouseLeave={stopTriggerAnimation}
            onFocus={startTriggerAnimation}
            onBlur={stopTriggerAnimation}
          />
        }
      >
        {theme === "light" ? (
          <SunIcon
            ref={triggerSunRef}
            size={18}
            className="h-[1.125rem] w-[1.125rem]"
          />
        ) : null}
        {theme === "dark" ? (
          <MoonIcon
            ref={triggerMoonRef}
            size={18}
            className="h-[1.125rem] w-[1.125rem]"
          />
        ) : null}
        {theme === "system" ? (
          <ContrastIcon
            ref={triggerContrastRef}
            size={18}
            className="h-[1.125rem] w-[1.125rem]"
          />
        ) : null}
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[6rem]">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="gap-2 cursor-pointer"
        >
          <SunIcon size={16} className="h-4 w-4 shrink-0" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="gap-2 cursor-pointer"
        >
          <MoonIcon size={16} className="h-4 w-4 shrink-0" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="gap-2 cursor-pointer"
        >
          <ContrastIcon size={16} className="h-4 w-4 shrink-0" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
