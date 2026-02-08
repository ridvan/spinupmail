import * as React from "react";
import { useAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { useApiKeysQuery } from "@/features/settings/hooks/use-api-keys";
import type { DashboardStat } from "@/features/dashboard/types/dashboard.types";

const toStartOfDay = (date: Date) => {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
};

export const useDashboardStats = () => {
  const addressesQuery = useAddressesQuery();
  const apiKeysQuery = useApiKeysQuery();

  const stats = React.useMemo<DashboardStat[]>(() => {
    const addresses = addressesQuery.data ?? [];
    const apiKeys = apiKeysQuery.data ?? [];

    const now = Date.now();
    const dayStart = toStartOfDay(new Date());
    const weekStart = dayStart - 6 * 24 * 60 * 60 * 1000;

    const receivedToday = addresses.filter(address => {
      return Boolean(
        address.lastReceivedAtMs && address.lastReceivedAtMs >= dayStart
      );
    }).length;

    const activeThisWeek = addresses.filter(address => {
      return Boolean(
        address.lastReceivedAtMs && address.lastReceivedAtMs >= weekStart
      );
    }).length;

    const expiringSoon = addresses.filter(address => {
      return Boolean(
        address.expiresAtMs &&
        address.expiresAtMs > now &&
        address.expiresAtMs <= now + 24 * 60 * 60 * 1000
      );
    }).length;

    return [
      {
        label: "Today",
        value: String(receivedToday),
        hint: "Addresses that received mail in the last 24h",
      },
      {
        label: "This Week",
        value: String(activeThisWeek),
        hint: "Addresses active in the last 7 days",
      },
      {
        label: "Total Inboxes",
        value: String(addresses.length),
        hint: "All generated addresses",
      },
      {
        label: "API Keys",
        value: String(apiKeys.length),
        hint:
          expiringSoon > 0
            ? `${expiringSoon} address(es) expiring soon`
            : "No near-term expirations",
      },
    ];
  }, [addressesQuery.data, apiKeysQuery.data]);

  return {
    stats,
    addressesQuery,
    apiKeysQuery,
  };
};
