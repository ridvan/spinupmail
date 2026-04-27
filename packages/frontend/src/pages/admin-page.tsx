import * as React from "react";
import NumberFlow from "@number-flow/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, XAxis } from "recharts";
import { toast } from "sonner";
import {
  Ban,
  Database,
  KeyRound,
  Mail,
  Mailbox,
  RefreshCcw,
  Shield,
  Users,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ChartAnalysisIcon,
  DashboardSquare01Icon,
  FolderIcon,
  UserMultiple02Icon,
} from "@/lib/hugeicons";
import { HashTabsPage } from "@/components/layout/hash-tabs-page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { formatDashboardDayLabel } from "@/features/timezone/lib/date-format";
import { authClient } from "@/lib/auth";
import {
  getAdminActivity,
  getAdminOverview,
  listAdminAnomalies,
  listAdminOrganizations,
  type AdminOperationalEventsResponse,
  type AdminOrganizationsResponse,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const PAGE_SIZE = 10;
const ANOMALY_SEVERITIES = ["all", "info", "warning", "error"] as const;
const ANOMALY_TYPES = [
  "all",
  "inbound_rejected",
  "inbound_duplicate",
  "inbound_limit_reached",
  "inbound_abuse_block",
  "inbound_parse_failed",
  "inbound_storage_failed",
  "integration_dispatch_failed",
  "system_error",
];

const chartConfig = {
  generatedAddresses: {
    label: "Addresses",
    color: "var(--chart-1)",
  },
  receivedEmails: {
    label: "Emails",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role?: string | string[] | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | string | null;
  emailVerified?: boolean | null;
  createdAt?: Date | string | null;
};

type AdminSession = {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date | string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type AdminUsersResponse = {
  users: AdminUser[];
  total: number;
};

type PendingUserAction =
  | { type: "set-role"; user: AdminUser; role: "admin" | "user" }
  | { type: "ban"; user: AdminUser }
  | { type: "unban"; user: AdminUser }
  | { type: "revoke-sessions"; user: AdminUser }
  | null;

const readAuthError = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};

const listAdminUsers = async ({
  page,
  pageSize,
  search,
}: {
  page: number;
  pageSize: number;
  search: string;
}): Promise<AdminUsersResponse> => {
  const result = await authClient.admin.listUsers({
    query: {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortBy: "createdAt",
      sortDirection: "desc",
      ...(search.trim()
        ? {
            searchValue: search.trim(),
            searchField: "email" as const,
            searchOperator: "contains" as const,
          }
        : {}),
    },
  });

  if (result.error) {
    throw new Error(readAuthError(result.error, "Unable to load users"));
  }

  return {
    users: (result.data?.users ?? []) as AdminUser[],
    total: result.data?.total ?? 0,
  };
};

const listAdminUserSessions = async (
  userId: string
): Promise<AdminSession[]> => {
  const result = await authClient.admin.listUserSessions({ userId });

  if (result.error) {
    throw new Error(readAuthError(result.error, "Unable to load sessions"));
  }

  return (result.data?.sessions ?? []) as AdminSession[];
};

const formatNumber = (value: number) => value.toLocaleString();

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "Never";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatBytes = (bytes: number) => {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
};

const getRoleLabel = (role: AdminUser["role"]) =>
  Array.isArray(role) ? role.join(", ") : (role ?? "user");

const isAdminUser = (user: AdminUser) =>
  getRoleLabel(user.role)
    .split(",")
    .map(role => role.trim())
    .includes("admin");

const MetricCard = ({
  icon: Icon,
  label,
  value,
  detail,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  loading?: boolean;
}) => (
  <Card className="border-border/70 bg-card/60">
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </CardTitle>
    </CardHeader>
    <CardContent className="flex min-h-16 flex-col justify-end gap-1">
      {loading ? (
        <>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-32" />
        </>
      ) : (
        <>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          {detail ? (
            <div className="text-xs text-muted-foreground">{detail}</div>
          ) : null}
        </>
      )}
    </CardContent>
  </Card>
);

const AdminOverviewPanel = () => {
  const { effectiveTimeZone } = useTimezone();
  const overviewQuery = useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: ({ signal }) => getAdminOverview({ signal }),
    staleTime: 30_000,
  });
  const activityQuery = useQuery({
    queryKey: queryKeys.adminActivity(effectiveTimeZone),
    queryFn: ({ signal }) =>
      getAdminActivity({ days: 14, timezone: effectiveTimeZone, signal }),
    staleTime: 30_000,
  });
  const overview = overviewQuery.data;
  const daily = activityQuery.data?.daily ?? [];
  const isLoading = overviewQuery.isLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Mailbox}
          label="Generated addresses"
          loading={isLoading}
          value={
            <NumberFlow value={overview?.generatedAddresses.current ?? 0} />
          }
          detail={`Previous 30d: ${formatNumber(overview?.generatedAddresses.previous ?? 0)}`}
        />
        <MetricCard
          icon={Mail}
          label="Received emails"
          loading={isLoading}
          value={<NumberFlow value={overview?.receivedEmails.current ?? 0} />}
          detail={`Samples: ${formatNumber(overview?.sampleEmails.current ?? 0)}`}
        />
        <MetricCard
          icon={Users}
          label="Users"
          loading={isLoading}
          value={<NumberFlow value={overview?.users ?? 0} />}
          detail={`${formatNumber(overview?.activeUsers24h ?? 0)} active in 24h`}
        />
        <MetricCard
          icon={Shield}
          label="System status"
          loading={isLoading}
          value={
            <span className="capitalize">
              {overview?.system.status ?? "healthy"}
            </span>
          }
          detail={`${formatNumber(overview?.anomalies.last24h ?? 0)} anomalies in 24h`}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <HugeiconsIcon
                icon={ChartAnalysisIcon}
                strokeWidth={2}
                className="size-4"
              />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityQuery.isLoading ? (
              <div className="flex h-[220px] items-end gap-2 px-2">
                {Array.from({ length: 14 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="w-full rounded-sm"
                    style={{ height: `${40 + ((index * 17) % 110)}px` }}
                  />
                ))}
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <BarChart
                  data={daily}
                  margin={{ top: 12, right: 12, left: 12 }}
                >
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={value => String(value).slice(-2)}
                    tick={{ fontSize: 10 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={formatDashboardDayLabel}
                      />
                    }
                  />
                  <Bar
                    dataKey="generatedAddresses"
                    fill="var(--color-generatedAddresses)"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="receivedEmails"
                    fill="var(--color-receivedEmails)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Database className="size-4" />
              Operations
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <StatRow
              label="Organizations"
              value={overview?.organizations ?? 0}
            />
            <StatRow
              label="Attachment storage"
              value={formatBytes(overview?.attachments.sizeTotal ?? 0)}
            />
            <StatRow
              label="Attachments"
              value={overview?.attachments.count ?? 0}
            />
            <Separator />
            <StatRow
              label="Active integrations"
              value={overview?.integrations.active ?? 0}
            />
            <StatRow
              label="Retry scheduled"
              value={overview?.integrations.retryScheduled ?? 0}
            />
            <StatRow
              label="Failed dispatches"
              value={overview?.integrations.failed ?? 0}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

const StatRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium tabular-nums">
      {typeof value === "number" ? formatNumber(value) : value}
    </span>
  </div>
);

const AdminUsersPanel = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [selectedSessionUser, setSelectedSessionUser] =
    React.useState<AdminUser | null>(null);
  const [pendingAction, setPendingAction] =
    React.useState<PendingUserAction>(null);
  const usersQuery = useQuery({
    queryKey: queryKeys.adminUsers(page, PAGE_SIZE, search),
    queryFn: () => listAdminUsers({ page, pageSize: PAGE_SIZE, search }),
    staleTime: 30_000,
  });
  const sessionsQuery = useQuery({
    queryKey: queryKeys.adminUserSessions(selectedSessionUser?.id ?? null),
    queryFn: () => listAdminUserSessions(selectedSessionUser?.id ?? ""),
    enabled: Boolean(selectedSessionUser?.id),
    staleTime: 15_000,
  });
  const actionMutation = useMutation({
    mutationFn: async (action: NonNullable<PendingUserAction>) => {
      if (action.type === "set-role") {
        const result = await authClient.admin.setRole({
          userId: action.user.id,
          role: action.role,
        });
        if (result.error)
          throw new Error(readAuthError(result.error, "Unable to set role"));
        return;
      }
      if (action.type === "ban") {
        const result = await authClient.admin.banUser({
          userId: action.user.id,
          banReason: "Administrative action",
        });
        if (result.error)
          throw new Error(readAuthError(result.error, "Unable to ban user"));
        return;
      }
      if (action.type === "unban") {
        const result = await authClient.admin.unbanUser({
          userId: action.user.id,
        });
        if (result.error)
          throw new Error(readAuthError(result.error, "Unable to unban user"));
        return;
      }
      const result = await authClient.admin.revokeUserSessions({
        userId: action.user.id,
      });
      if (result.error)
        throw new Error(
          readAuthError(result.error, "Unable to revoke sessions")
        );
    },
    onSuccess: async () => {
      setPendingAction(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app", "admin", "users"] }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.adminUserSessions(
            selectedSessionUser?.id ?? null
          ),
        }),
      ]);
    },
  });
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionToken: string) => {
      const result = await authClient.admin.revokeUserSession({ sessionToken });
      if (result.error) {
        throw new Error(
          readAuthError(result.error, "Unable to revoke session")
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminUserSessions(selectedSessionUser?.id ?? null),
      });
    },
  });
  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          aria-label="Search users"
          className="max-w-sm"
          placeholder="Search email"
          value={search}
          onChange={event => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void usersQuery.refetch()}
          disabled={usersQuery.isFetching}
        >
          {usersQuery.isFetching ? (
            <Spinner aria-hidden="true" />
          ) : (
            <RefreshCcw data-icon="inline-start" />
          )}
          Refresh
        </Button>
      </div>

      <AdminTableShell
        loading={usersQuery.isLoading}
        columns={["User", "Role", "Status", "Created", "Actions"]}
      >
        {users.map(user => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="flex min-w-56 flex-col">
                <span className="font-medium">{user.name || "Unnamed"}</span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={isAdminUser(user) ? "default" : "outline"}>
                {getRoleLabel(user.role)}
              </Badge>
            </TableCell>
            <TableCell>
              {user.banned ? (
                <Badge variant="destructive">Banned</Badge>
              ) : (
                <Badge variant="secondary">Active</Badge>
              )}
            </TableCell>
            <TableCell>{formatDate(user.createdAt)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPendingAction({
                      type: "set-role",
                      user,
                      role: isAdminUser(user) ? "user" : "admin",
                    })
                  }
                >
                  <KeyRound data-icon="inline-start" />
                  Role
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPendingAction({
                      type: user.banned ? "unban" : "ban",
                      user,
                    })
                  }
                >
                  <Ban data-icon="inline-start" />
                  {user.banned ? "Unban" : "Ban"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSessionUser(user)}
                >
                  Sessions
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </AdminTableShell>

      <PaginationFooter
        page={page}
        totalPages={totalPages}
        onPrevious={() => setPage(value => Math.max(1, value - 1))}
        onNext={() => setPage(value => value + 1)}
      />

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={open => {
          if (!open && !actionMutation.isPending) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getActionTitle(pendingAction)}</AlertDialogTitle>
            <AlertDialogDescription>
              {getActionDescription(pendingAction)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionMutation.error ? (
            <p className="text-sm text-destructive">
              {(actionMutation.error as Error).message}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingAction || actionMutation.isPending}
              onClick={event => {
                event.preventDefault();
                if (pendingAction) actionMutation.mutate(pendingAction);
              }}
            >
              {actionMutation.isPending ? <Spinner aria-hidden="true" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(selectedSessionUser)}
        onOpenChange={open => {
          if (!open) setSelectedSessionUser(null);
        }}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Sessions</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSessionUser?.email ?? "Selected user"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsQuery.isLoading ? (
                  <SkeletonRows columns={4} />
                ) : (
                  (sessionsQuery.data ?? []).map(session => (
                    <TableRow key={session.id}>
                      <TableCell>{formatDate(session.createdAt)}</TableCell>
                      <TableCell>{formatDate(session.expiresAt)}</TableCell>
                      <TableCell>{session.ipAddress ?? "Unknown"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={revokeSessionMutation.isPending}
                          onClick={() => {
                            toast.promise(
                              revokeSessionMutation.mutateAsync(session.token),
                              {
                                loading: "Revoking session...",
                                success: "Session revoked.",
                                error: error =>
                                  error instanceof Error
                                    ? error.message
                                    : "Unable to revoke session",
                              }
                            );
                          }}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter>
            <Button
              variant="outline"
              disabled={!selectedSessionUser || actionMutation.isPending}
              onClick={() => {
                if (selectedSessionUser) {
                  const user = selectedSessionUser;
                  setSelectedSessionUser(null);
                  setPendingAction({
                    type: "revoke-sessions",
                    user,
                  });
                }
              }}
            >
              Revoke all
            </Button>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const getActionTitle = (action: PendingUserAction) => {
  if (!action) return "Confirm action";
  if (action.type === "set-role") return `Set role to ${action.role}`;
  if (action.type === "ban") return "Ban user";
  if (action.type === "unban") return "Unban user";
  return "Revoke sessions";
};

const getActionDescription = (action: PendingUserAction) => {
  if (!action) return "";
  if (action.type === "set-role") {
    return `${action.user.email} will receive the ${action.role} role.`;
  }
  if (action.type === "ban") {
    return `${action.user.email} will be blocked from signing in.`;
  }
  if (action.type === "unban") {
    return `${action.user.email} will be allowed to sign in again.`;
  }
  return `All active sessions for ${action.user.email} will be revoked.`;
};

const AdminOrganizationsPanel = () => {
  const [page, setPage] = React.useState(1);
  const organizationsQuery = useQuery<AdminOrganizationsResponse>({
    queryKey: queryKeys.adminOrganizations(page, PAGE_SIZE),
    queryFn: ({ signal }) =>
      listAdminOrganizations({ page, pageSize: PAGE_SIZE, signal }),
    staleTime: 30_000,
  });
  const organizations = organizationsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AdminTableShell
        loading={organizationsQuery.isLoading}
        columns={[
          "Organization",
          "Members",
          "Addresses",
          "Received",
          "Integrations",
          "Last mail",
        ]}
      >
        {organizations.map(org => (
          <TableRow key={org.id}>
            <TableCell>
              <div className="flex min-w-56 flex-col">
                <span className="font-medium">{org.name}</span>
                <span className="text-xs text-muted-foreground">
                  {org.slug}
                </span>
              </div>
            </TableCell>
            <TableCell>{formatNumber(org.memberCount)}</TableCell>
            <TableCell>{formatNumber(org.addressCount)}</TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span>{formatNumber(org.receivedEmailCount)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(org.sampleEmailCount)} samples
                </span>
              </div>
            </TableCell>
            <TableCell>
              {formatNumber(org.activeIntegrationCount)} /{" "}
              {formatNumber(org.integrationCount)}
            </TableCell>
            <TableCell>{formatDate(org.lastReceivedAt)}</TableCell>
          </TableRow>
        ))}
      </AdminTableShell>
      <PaginationFooter
        page={page}
        totalPages={organizationsQuery.data?.totalPages ?? 0}
        onPrevious={() => setPage(value => Math.max(1, value - 1))}
        onNext={() => setPage(value => value + 1)}
      />
    </div>
  );
};

const AdminAnomaliesPanel = () => {
  const [page, setPage] = React.useState(1);
  const [severity, setSeverity] =
    React.useState<(typeof ANOMALY_SEVERITIES)[number]>("all");
  const [type, setType] = React.useState<(typeof ANOMALY_TYPES)[number]>("all");
  const [organizationId, setOrganizationId] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const anomaliesQuery = useQuery<AdminOperationalEventsResponse>({
    queryKey: queryKeys.adminAnomalies(
      page,
      PAGE_SIZE,
      severity,
      type,
      organizationId,
      fromDate,
      toDate
    ),
    queryFn: ({ signal }) =>
      listAdminAnomalies({
        page,
        pageSize: PAGE_SIZE,
        severity: severity === "all" ? undefined : severity,
        type: type === "all" ? undefined : type,
        organizationId: organizationId.trim() || undefined,
        from: fromDate
          ? new Date(`${fromDate}T00:00:00.000Z`).toISOString()
          : undefined,
        to: toDate
          ? new Date(`${toDate}T23:59:59.999Z`).toISOString()
          : undefined,
        signal,
      }),
    staleTime: 30_000,
  });
  const anomalies = anomaliesQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Organization ID"
          className="h-8 w-52"
          placeholder="Organization ID"
          value={organizationId}
          onChange={event => {
            setPage(1);
            setOrganizationId(event.target.value);
          }}
        />
        <Select
          value={severity}
          onValueChange={value => {
            setPage(1);
            setSeverity(value as typeof severity);
          }}
        >
          <SelectTrigger size="sm" aria-label="Severity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ANOMALY_SEVERITIES.map(item => (
                <SelectItem key={item} value={item}>
                  {item === "all" ? "All severities" : item}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={type}
          onValueChange={value => {
            setPage(1);
            setType(value as typeof type);
          }}
        >
          <SelectTrigger size="sm" aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ANOMALY_TYPES.map(item => (
                <SelectItem key={item} value={item}>
                  {item === "all" ? "All types" : item.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Input
          aria-label="From date"
          className="h-8 w-36"
          type="date"
          value={fromDate}
          onChange={event => {
            setPage(1);
            setFromDate(event.target.value);
          }}
        />
        <Input
          aria-label="To date"
          className="h-8 w-36"
          type="date"
          value={toDate}
          onChange={event => {
            setPage(1);
            setToDate(event.target.value);
          }}
        />
      </div>

      <AdminTableShell
        loading={anomaliesQuery.isLoading}
        columns={["Event", "Severity", "Organization", "Created"]}
      >
        {anomalies.map(event => (
          <TableRow key={event.id}>
            <TableCell>
              <div className="flex min-w-72 flex-col">
                <span className="font-medium">{event.message}</span>
                <span className="text-xs text-muted-foreground">
                  {event.type.replaceAll("_", " ")}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <SeverityBadge severity={event.severity} />
            </TableCell>
            <TableCell>
              {event.organizationName ?? event.organizationId ?? "System"}
            </TableCell>
            <TableCell>{formatDate(event.createdAt)}</TableCell>
          </TableRow>
        ))}
      </AdminTableShell>
      <PaginationFooter
        page={page}
        totalPages={anomaliesQuery.data?.totalPages ?? 0}
        onPrevious={() => setPage(value => Math.max(1, value - 1))}
        onNext={() => setPage(value => value + 1)}
      />
    </div>
  );
};

const SeverityBadge = ({ severity }: { severity: string }) => {
  if (severity === "error") return <Badge variant="destructive">Error</Badge>;
  if (severity === "warning") return <Badge variant="secondary">Warning</Badge>;
  return <Badge variant="outline">Info</Badge>;
};

const AdminTableShell = ({
  columns,
  loading,
  children,
}: {
  columns: string[];
  loading: boolean;
  children: React.ReactNode;
}) => (
  <div className="rounded-lg border border-border/70">
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map(column => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? <SkeletonRows columns={columns.length} /> : children}
      </TableBody>
    </Table>
  </div>
);

const SkeletonRows = ({ columns }: { columns: number }) => (
  <>
    {Array.from({ length: 5 }).map((_, rowIndex) => (
      <TableRow key={rowIndex}>
        {Array.from({ length: columns }).map((__, columnIndex) => (
          <TableCell key={columnIndex}>
            <Skeleton className="h-5 w-full max-w-32" />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

const PaginationFooter = ({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}) => (
  <div className="flex items-center justify-end gap-2">
    <span className="text-xs text-muted-foreground">
      Page {page}
      {totalPages > 0 ? ` of ${totalPages}` : ""}
    </span>
    <Button
      variant="outline"
      size="sm"
      disabled={page <= 1}
      onClick={onPrevious}
    >
      Previous
    </Button>
    <Button
      variant="outline"
      size="sm"
      disabled={totalPages === 0 || page >= totalPages}
      onClick={onNext}
    >
      Next
    </Button>
  </div>
);

const adminSections = [
  {
    id: "overview",
    label: "Overview",
    icon: DashboardSquare01Icon,
    content: <AdminOverviewPanel />,
  },
  {
    id: "users",
    label: "Users",
    icon: UserMultiple02Icon,
    content: <AdminUsersPanel />,
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: FolderIcon,
    content: <AdminOrganizationsPanel />,
  },
  {
    id: "anomalies",
    label: "Anomalies",
    icon: Alert02Icon,
    content: <AdminAnomaliesPanel />,
  },
];

export const AdminPage = () => {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <HashTabsPage
        ariaLabel="Admin sections"
        defaultSection="overview"
        sections={adminSections}
      />
    </div>
  );
};
