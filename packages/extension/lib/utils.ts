import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatRelativeTime = (value: number | null) => {
  if (!value) return "No mail yet";

  const minutes = Math.max(1, Math.round((Date.now() - value) / 60_000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(value);
};

export const clampList = <TData>(items: TData[], maxItems: number) =>
  items.slice(Math.max(0, items.length - maxItems));

export const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";
