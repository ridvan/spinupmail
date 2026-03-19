import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { TIMEZONE_SEARCH_PLACEHOLDER } from "@/features/settings/lib/timezone-picker";

export const TimezoneCommandList = ({
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
            <CommandItem
              key={timeZone}
              value={timeZone}
              data-checked={selectedTimeZone === timeZone ? true : undefined}
              onSelect={() => {
                onSelectTimeZone(timeZone);
              }}
            >
              <span className="truncate">{timeZone}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
};
