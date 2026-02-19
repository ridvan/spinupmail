import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { formatDateTimeInTimeZone } from "@/features/timezone/lib/date-format";
import { getSupportedTimeZones } from "@/features/timezone/lib/timezone-options";

const describeSource = (source: string) => {
  switch (source) {
    case "user":
      return "Saved preference";
    case "browser":
      return "Device timezone";
    case "session":
      return "Cloudflare geolocation";
    default:
      return "UTC fallback";
  }
};

const normalizeTimezoneSearchValue = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[_/.-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();

export const TimezonePanel = () => {
  const {
    effectiveTimeZone,
    savedTimeZone,
    source,
    isSaving,
    error,
    setTimeZone,
    clearTimeZone,
  } = useTimezone();
  const [searchValue, setSearchValue] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [manualMode, setManualMode] = React.useState(Boolean(savedTimeZone));
  const [selectedTimeZone, setSelectedTimeZone] = React.useState<string>(
    savedTimeZone ?? effectiveTimeZone
  );

  const supportedTimeZones = React.useMemo(() => getSupportedTimeZones(), []);

  React.useEffect(() => {
    setManualMode(Boolean(savedTimeZone));
    setSelectedTimeZone(savedTimeZone ?? effectiveTimeZone);
  }, [effectiveTimeZone, savedTimeZone]);

  const filteredTimeZones = React.useMemo(() => {
    if (!searchValue.trim()) return supportedTimeZones;
    const query = normalizeTimezoneSearchValue(searchValue);
    return supportedTimeZones.filter(timeZone =>
      normalizeTimezoneSearchValue(timeZone).includes(query)
    );
  }, [searchValue, supportedTimeZones]);

  const previewTimeZone = manualMode ? selectedTimeZone : effectiveTimeZone;
  const previewValue = formatDateTimeInTimeZone({
    value: new Date(),
    timeZone: previewTimeZone,
    options: {
      dateStyle: "full",
      timeStyle: "long",
    },
    fallback: "Unavailable",
  });
  const hasChanges = manualMode
    ? selectedTimeZone !== (savedTimeZone ?? "")
    : Boolean(savedTimeZone);

  const handleSave = async () => {
    setLocalError(null);

    try {
      if (!manualMode) {
        await clearTimeZone();
        return;
      }

      if (!selectedTimeZone) {
        setLocalError("Select a timezone to continue.");
        return;
      }
      await setTimeZone(selectedTimeZone);
    } catch (saveError) {
      if (saveError instanceof Error && saveError.message) {
        setLocalError(saveError.message);
      } else {
        setLocalError("Unable to update timezone.");
      }
    }
  };

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">Timezone</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose how dashboard dates and times are displayed.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Current: {effectiveTimeZone}</Badge>
          <Badge variant="outline">{describeSource(source)}</Badge>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={manualMode}
            onCheckedChange={checked => {
              setLocalError(null);
              setManualMode(Boolean(checked));
            }}
          />
          <span className="space-y-0.5">
            <span className="block font-medium">Use specific timezone</span>
            <span className="block text-muted-foreground">
              Turn off to automatically follow your device timezone.
            </span>
          </span>
        </label>

        {manualMode ? (
          <div className="space-y-2">
            <Command
              className="border border-border/70 bg-card"
              shouldFilter={false}
            >
              <CommandInput
                placeholder="Search timezone (e.g. America/New_York)"
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList className="max-h-64">
                <CommandEmpty>No timezone found.</CommandEmpty>
                <CommandGroup>
                  {filteredTimeZones.map(timeZone => (
                    <CommandItem
                      key={timeZone}
                      value={timeZone}
                      data-checked={
                        selectedTimeZone === timeZone ? true : undefined
                      }
                      onSelect={() => {
                        setLocalError(null);
                        setSelectedTimeZone(timeZone);
                      }}
                    >
                      <span className="truncate">{timeZone}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            <p className="text-xs text-muted-foreground">
              Selected:{" "}
              <span className="font-mono text-foreground">
                {selectedTimeZone}
              </span>
            </p>
          </div>
        ) : null}

        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
          <p className="text-xs text-muted-foreground">
            Current time in selected timezone:
          </p>
          <p className="font-medium">{previewValue}</p>
        </div>

        {error || localError ? (
          <p className="text-sm text-destructive">{localError || error}</p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={isSaving || !hasChanges}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving..." : "Save timezone"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
