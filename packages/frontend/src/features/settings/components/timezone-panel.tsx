import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TimezoneCommandList } from "@/features/settings/components/timezone-picker";
import { UserProfileTimezoneSection } from "@/features/settings/components/user-profile-timezone-section";
import { useFilteredTimeZones } from "@/features/settings/lib/timezone-picker";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";

const TimezonePanelEditor = ({
  effectiveTimeZone,
  savedTimeZone,
  source,
  isSaving,
  error,
  setTimeZone,
  clearTimeZone,
}: ReturnType<typeof useTimezone>) => {
  const [searchValue, setSearchValue] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [manualMode, setManualMode] = React.useState(Boolean(savedTimeZone));
  const [selectedTimeZone, setSelectedTimeZone] = React.useState<string>(
    savedTimeZone ?? effectiveTimeZone
  );
  const { filteredTimeZones } = useFilteredTimeZones(searchValue);

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
        <UserProfileTimezoneSection
          effectiveTimeZone={effectiveTimeZone}
          source={source}
          manualTimezoneField={
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={manualMode}
                onCheckedChange={checked => {
                  const nextManualMode = Boolean(checked);
                  setLocalError(null);
                  setManualMode(nextManualMode);
                  if (!nextManualMode) {
                    setSearchValue("");
                  }
                }}
              />
              <span className="space-y-0.5">
                <span className="block font-medium">Use specific timezone</span>
                <span className="block text-muted-foreground">
                  Turn off to automatically follow your device timezone.
                </span>
              </span>
            </label>
          }
          timezoneField={
            manualMode ? (
              <div className="space-y-2">
                <TimezoneCommandList
                  commandClassName="border border-border/70 bg-card"
                  searchValue={searchValue}
                  selectedTimeZone={selectedTimeZone}
                  timeZones={filteredTimeZones}
                  onSearchValueChange={setSearchValue}
                  onSelectTimeZone={timeZone => {
                    setLocalError(null);
                    setSelectedTimeZone(timeZone);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Selected:{" "}
                  <span className="font-mono text-foreground">
                    {selectedTimeZone}
                  </span>
                </p>
              </div>
            ) : null
          }
        />

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

export const TimezonePanel = () => {
  const timezone = useTimezone();
  const draftKey = `${timezone.savedTimeZone ?? ""}:${timezone.effectiveTimeZone}`;

  return <TimezonePanelEditor key={draftKey} {...timezone} />;
};
