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
    return new Date().toLocaleString("en-US", {
      timeZone,
      dateStyle: "full",
      timeStyle: "long",
    });
  }, [timeZone]);

  const [currentTime, setCurrentTime] = React.useState(getCurrentTime);
  const frameRef = React.useRef<number>(0);
  const lastTickRef = React.useRef<number>(0);

  React.useInsertionEffect(() => {
    const tick = (timestamp: number) => {
      if (timestamp - lastTickRef.current >= 1000) {
        lastTickRef.current = timestamp;
        setCurrentTime(getCurrentTime());
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [getCurrentTime]);

  return currentTime;
};

export const UserProfileTimezoneSection = ({
  effectiveTimeZone,
  source,
  manualTimezoneField,
  timezoneField,
}: {
  effectiveTimeZone: string;
  source: TimeZoneSource;
  manualTimezoneField: React.ReactNode;
  timezoneField: React.ReactNode;
}) => {
  const liveTime = useLiveTime(effectiveTimeZone);

  return (
    <div className="space-y-3 pt-1">
      <FieldLabel className="flex items-center gap-1.5">Timezone</FieldLabel>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{effectiveTimeZone}</Badge>
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
