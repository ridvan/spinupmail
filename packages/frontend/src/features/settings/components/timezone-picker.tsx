import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronsUpDownIcon,
  type ChevronsUpDownIconHandle,
} from "@/components/ui/chevrons-up-down";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldError } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  shouldStopMenuTypeaheadKey,
  TIMEZONE_SEARCH_PLACEHOLDER,
  useFilteredTimeZones,
} from "@/features/settings/lib/timezone-picker";
import { toFieldErrors } from "@/lib/forms/to-field-errors";

const TIMEZONE_INITIAL_RENDER_COUNT = 120;
const TIMEZONE_RENDER_CHUNK = 120;

type TimezonePopoverChangeDetails = Parameters<
  NonNullable<React.ComponentProps<typeof Popover>["onOpenChange"]>
>[1];

const TimezoneCommandItem = React.memo(
  ({
    timeZone,
    isSelected,
    onSelectTimeZone,
  }: {
    timeZone: string;
    isSelected: boolean;
    onSelectTimeZone: (timeZone: string) => void;
  }) => {
    const handleSelect = React.useCallback(() => {
      onSelectTimeZone(timeZone);
    }, [onSelectTimeZone, timeZone]);

    return (
      <CommandItem
        value={timeZone}
        data-checked={isSelected ? true : undefined}
        onSelect={handleSelect}
      >
        <span className="truncate">{timeZone}</span>
      </CommandItem>
    );
  }
);

TimezoneCommandItem.displayName = "TimezoneCommandItem";

export const TimezoneCommandList = React.memo(
  ({
    timeZones,
    selectedTimeZone,
    searchValue,
    onSearchValueChange,
    onSelectTimeZone,
    commandClassName,
    onInputKeyDown,
    inputRef,
  }: {
    timeZones: string[];
    selectedTimeZone: string;
    searchValue: string;
    onSearchValueChange: (value: string) => void;
    onSelectTimeZone: (timeZone: string) => void;
    commandClassName?: string;
    onInputKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    inputRef?: React.Ref<HTMLInputElement>;
  }) => {
    return (
      <Command
        className={commandClassName}
        label="Search timezones"
        shouldFilter={false}
      >
        <CommandInput
          aria-label="Search timezones"
          placeholder={TIMEZONE_SEARCH_PLACEHOLDER}
          ref={inputRef}
          value={searchValue}
          onValueChange={onSearchValueChange}
          onKeyDown={onInputKeyDown}
        />
        <CommandList className="max-h-64">
          <CommandEmpty>No timezone found.</CommandEmpty>
          <CommandGroup>
            {timeZones.map(timeZone => (
              <TimezoneCommandItem
                key={timeZone}
                timeZone={timeZone}
                isSelected={selectedTimeZone === timeZone}
                onSelectTimeZone={onSelectTimeZone}
              />
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }
);

TimezoneCommandList.displayName = "TimezoneCommandList";

export const TimezonePickerField = React.memo(
  ({
    value,
    disabled,
    isInvalid,
    errors,
    onChange,
  }: {
    value: string;
    disabled: boolean;
    isInvalid: boolean;
    errors: unknown[];
    onChange: (timeZone: string) => void;
  }) => {
    const [searchValue, setSearchValue] = React.useState("");
    const [isTimezoneMenuOpen, setIsTimezoneMenuOpen] = React.useState(false);
    const [visibleTimezoneCount, setVisibleTimezoneCount] = React.useState(
      TIMEZONE_INITIAL_RENDER_COUNT
    );
    const timezoneTriggerRef = React.useRef<HTMLButtonElement | null>(null);
    const timezoneChevronsRef = React.useRef<ChevronsUpDownIconHandle | null>(
      null
    );
    const timezoneSearchInputRef = React.useRef<HTMLInputElement | null>(null);
    const { filteredTimeZones, normalizedSearchValue } =
      useFilteredTimeZones(searchValue);

    const restoreTimezoneTriggerFocus = React.useCallback(() => {
      if (typeof window === "undefined") return;

      window.requestAnimationFrame(() => {
        timezoneTriggerRef.current?.focus({ preventScroll: true });
      });
    }, []);

    React.useEffect(() => {
      if (!isTimezoneMenuOpen) {
        setVisibleTimezoneCount(TIMEZONE_INITIAL_RENDER_COUNT);
        return;
      }

      if (normalizedSearchValue.length > 0) {
        setVisibleTimezoneCount(filteredTimeZones.length);
        return;
      }

      setVisibleTimezoneCount(TIMEZONE_INITIAL_RENDER_COUNT);
      let animationFrameId = 0;

      const renderNextChunk = () => {
        setVisibleTimezoneCount(previous => {
          const next = Math.min(
            filteredTimeZones.length,
            previous + TIMEZONE_RENDER_CHUNK
          );

          if (next < filteredTimeZones.length) {
            animationFrameId = requestAnimationFrame(renderNextChunk);
          }

          return next;
        });
      };

      animationFrameId = requestAnimationFrame(renderNextChunk);

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    }, [filteredTimeZones.length, isTimezoneMenuOpen, normalizedSearchValue]);

    const visibleTimeZones = React.useMemo(() => {
      if (normalizedSearchValue.length > 0) return filteredTimeZones;
      return filteredTimeZones.slice(0, visibleTimezoneCount);
    }, [filteredTimeZones, normalizedSearchValue, visibleTimezoneCount]);

    const handleTimezoneTriggerMouseEnter = React.useCallback(() => {
      if (isTimezoneMenuOpen) return;
      timezoneChevronsRef.current?.startAnimation();
    }, [isTimezoneMenuOpen]);

    const handleTimezoneTriggerMouseLeave = React.useCallback(() => {
      if (isTimezoneMenuOpen) return;
      timezoneChevronsRef.current?.stopAnimation();
    }, [isTimezoneMenuOpen]);

    const handleTimezonePopoverOpenChange = React.useCallback(
      (open: boolean, eventDetails: TimezonePopoverChangeDetails) => {
        setIsTimezoneMenuOpen(open);
        if (open) {
          timezoneChevronsRef.current?.startAnimation();
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => {
              timezoneSearchInputRef.current?.focus({ preventScroll: true });
            });
          }
          return;
        }

        setSearchValue("");
        timezoneChevronsRef.current?.stopAnimation();
        if (eventDetails.reason === "escape-key") {
          restoreTimezoneTriggerFocus();
        }
      },
      [restoreTimezoneTriggerFocus]
    );

    const handleInputKeyDown = React.useCallback<
      React.KeyboardEventHandler<HTMLInputElement>
    >(event => {
      if (!shouldStopMenuTypeaheadKey(event.key)) return;
      event.stopPropagation();
    }, []);

    const handleSelectTimeZone = React.useCallback(
      (timeZone: string) => {
        onChange(timeZone);
        setIsTimezoneMenuOpen(false);
        setSearchValue("");
        restoreTimezoneTriggerFocus();
      },
      [onChange, restoreTimezoneTriggerFocus]
    );

    return (
      <Field data-invalid={isInvalid}>
        <Popover
          open={isTimezoneMenuOpen}
          modal={false}
          onOpenChange={handleTimezonePopoverOpenChange}
        >
          <PopoverTrigger
            ref={timezoneTriggerRef}
            render={
              <Button
                aria-label={value || "Select timezone"}
                type="button"
                variant="outline"
                className="max-w-102 justify-between font-normal"
                disabled={disabled}
                onMouseEnter={handleTimezoneTriggerMouseEnter}
                onMouseLeave={handleTimezoneTriggerMouseLeave}
              />
            }
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {value || "Select timezone"}
            </span>
            <ChevronsUpDownIcon
              ref={timezoneChevronsRef}
              size={16}
              className="ml-2 shrink-0 text-muted-foreground"
            />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="p-0"
            initialFocus={false}
            finalFocus={false}
          >
            <TimezoneCommandList
              commandClassName="border-0 bg-card"
              inputRef={timezoneSearchInputRef}
              searchValue={searchValue}
              selectedTimeZone={value}
              timeZones={visibleTimeZones}
              onSearchValueChange={setSearchValue}
              onInputKeyDown={handleInputKeyDown}
              onSelectTimeZone={handleSelectTimeZone}
            />
          </PopoverContent>
        </Popover>
        {isInvalid ? <FieldError errors={toFieldErrors(errors)} /> : null}
      </Field>
    );
  }
);

TimezonePickerField.displayName = "TimezonePickerField";
