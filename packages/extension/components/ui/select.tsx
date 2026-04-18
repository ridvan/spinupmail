import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Tick02Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

// eslint-disable-next-line react-refresh/only-export-components
export const Select = SelectPrimitive.Root;

export function SelectValue(props: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      className={cn("flex flex-1 text-left", props.className)}
      {...props}
    />
  );
}

export function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "border-input dark:bg-input/30 flex h-8 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <HugeiconsIcon
            icon={UnfoldMoreIcon}
            strokeWidth={2}
            className="text-muted-foreground size-4"
          />
        }
      />
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="z-50"
      >
        <SelectPrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground ring-foreground/10 max-h-[300px] min-w-48 overflow-y-auto rounded-xl shadow-md ring-1 data-open:animate-in data-closed:animate-out data-open:fade-in-0 data-closed:fade-out-0 data-open:zoom-in-95 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow className="bg-popover flex items-center justify-center py-1">
            <HugeiconsIcon
              icon={ArrowUp01Icon}
              strokeWidth={2}
              className="size-4"
            />
          </SelectPrimitive.ScrollUpArrow>
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow className="bg-popover flex items-center justify-center py-1">
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="size-4"
            />
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-lg py-2 pr-8 pl-2.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 items-center gap-2">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2">
        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
