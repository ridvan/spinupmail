import * as React from "react";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FieldLabel } from "@/components/ui/field";
import { type TimeZoneSource } from "@/features/timezone/lib/resolve-timezone";

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

export const UserProfileTimezoneSection = ({
  effectiveTimeZone,
  source,
  previewValue,
  manualTimezoneField,
  timezoneField,
}: {
  effectiveTimeZone: string;
  source: TimeZoneSource;
  previewValue: string;
  manualTimezoneField: React.ReactNode;
  timezoneField: React.ReactNode;
}) => {
  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-4">
      <FieldLabel className="flex items-center gap-1.5 text-muted-foreground">
        <Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>Timezone</span>
      </FieldLabel>

      <div className="flex flex-wrap items-center gap-2">
        <span>Current:</span>{" "}
        <Badge variant="secondary">{effectiveTimeZone}</Badge>
        <Badge variant="outline">{describeSource(source)}</Badge>
      </div>

      {manualTimezoneField}
      {timezoneField}

      <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
        <p className="text-xs text-muted-foreground">
          Current time in selected timezone:
        </p>
        <p className="font-medium">{previewValue}</p>
      </div>
    </div>
  );
};
