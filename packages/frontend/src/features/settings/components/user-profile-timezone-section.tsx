import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { FieldLabel } from "@/components/ui/field";
import { type TimeZoneSource } from "@/features/timezone/lib/resolve-timezone";
import { HugeiconsIcon } from "@hugeicons/react";
import { TimeZoneIcon } from "@hugeicons/core-free-icons";

const describeSource = (source: TimeZoneSource) => {
  switch (source) {
    case "user":
      return "Saved preference";
    case "browser":
      return "Device timezone";
    case "session":
      return "Cloudflare geolocation";
    case "utc":
      return "UTC fallback";
    default:
      return source satisfies never;
  }
};

const useLiveTime = (timeZone: string) => {
  const getCurrentTime = React.useCallback(() => {
    try {
      return new Date().toLocaleString("en-US", {
        timeZone,
        dateStyle: "full",
        timeStyle: "long",
      });
    } catch {
      try {
        return new Date().toLocaleString("en-US", {
          dateStyle: "full",
          timeStyle: "long",
        });
      } catch {
        return new Date().toString();
      }
    }
  }, [timeZone]);

  const subscribe = React.useCallback((onStoreChange: () => void) => {
    const intervalId = window.setInterval(onStoreChange, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return React.useSyncExternalStore(subscribe, getCurrentTime, () => "");
};

export const UserProfileTimezoneSection = ({
  effectiveTimeZone,
  previewTimeZone,
  source,
  manualTimezoneField,
  timezoneField,
}: {
  effectiveTimeZone: string;
  previewTimeZone?: string;
  source: TimeZoneSource;
  manualTimezoneField: React.ReactNode;
  timezoneField: React.ReactNode;
}) => {
  const activeTimeZone = previewTimeZone ?? effectiveTimeZone;
  const liveTime = useLiveTime(activeTimeZone);

  return (
    <div className="space-y-3 pt-1">
      <FieldLabel className="flex items-center gap-1.5">Timezone</FieldLabel>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{activeTimeZone}</Badge>
        <Badge variant="outline">{describeSource(source)}</Badge>
      </div>
      <div className="flex flex-row gap-2 max-w-102 text-sm text-muted-foreground">
        <HugeiconsIcon
          aria-hidden="true"
          icon={TimeZoneIcon}
          className="h-3.5 w-3.5 ml-0.5 mt-1"
          strokeWidth={2}
        />
        <p className="font-medium">{liveTime}</p>
      </div>

      {manualTimezoneField}
      {timezoneField}
    </div>
  );
};
