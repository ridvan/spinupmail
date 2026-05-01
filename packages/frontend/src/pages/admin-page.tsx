import * as React from "react";
import NumberFlow from "@number-flow/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  isPlatformAdminRole,
  type AdminOperationalEventType,
} from "@spinupmail/contracts";
import { Bar, BarChart, XAxis } from "recharts";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Database,
  Eye,
  KeyRound,
  Mail,
  Mailbox,
  PlugZap,
  RefreshCcw,
  Users,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ChartAnalysisIcon,
  DashboardSquare01Icon,
  FolderIcon,
  Key01Icon,
  LeftToRightListDashIcon,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { formatDashboardDayLabel } from "@/features/timezone/lib/date-format";
import { authClient } from "@/lib/auth";
import {
  getAdminOrganizationDetail,
  getAdminUserDetail,
  getAdminActivity,
  getAdminOverview,
  listAdminApiKeys,
  listAdminAnomalies,
  listAdminOrganizations,
  performAdminUserAction,
  type AdminApiKeysResponse,
  type AdminOperationalEventsResponse,
  type AdminOrganizationDetailResponse,
  type AdminOrganizationsResponse,
  type AdminUserDetailResponse,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const PAGE_SIZE = 10;
const PLATFORM_ROLE_OPTIONS = ["user", "admin"] as const;
const ANOMALY_SEVERITIES = ["all", "info", "warning", "error"] as const;
const ANOMALY_TYPES = [
  "all",
  "admin_user_action",
  "admin_session_action",
  "admin_impersonation_started",
  "inbound_rejected",
  "inbound_duplicate",
  "inbound_limit_reached",
  "inbound_abuse_block",
  "inbound_parse_failed",
  "inbound_storage_failed",
  "integration_dispatch_failed",
  "system_error",
] as const satisfies readonly (AdminOperationalEventType | "all")[];

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
  | {
      type: "set-role";
      user: AdminUser;
      role: (typeof PLATFORM_ROLE_OPTIONS)[number];
    }
  | { type: "ban"; user: AdminUser }
  | { type: "unban"; user: AdminUser }
  | { type: "impersonate"; user: AdminUser }
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

const getRoleLabel = (role: AdminUser["role"]) =>
  Array.isArray(role) ? role.join(", ") : (role ?? "user");

const isAdminUser = (user: AdminUser) => isPlatformAdminRole(user.role);

const parseRoleParts = (role: unknown) =>
  Array.isArray(role)
    ? role.map(value => String(value).trim())
    : typeof role === "string"
      ? role.split(",").map(value => value.trim())
      : [];

const hasPlatformRole = (role: unknown, expectedRole: string) =>
  parseRoleParts(role).includes(expectedRole);

const getPrimaryPlatformRole = (
  role: AdminUser["role"]
): (typeof PLATFORM_ROLE_OPTIONS)[number] => {
  const parts = parseRoleParts(role);
  return PLATFORM_ROLE_OPTIONS.find(option => parts.includes(option)) ?? "user";
};

const formatPercent = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);

const formatSignedNumber = (value: number) =>
  `${value > 0 ? "+" : ""}${formatNumber(value)}`;

const getTrendDetail = (current: number, previous: number) => {
  const delta = current - previous;
  if (previous === 0) {
    return delta > 0
      ? `${formatSignedNumber(delta)} vs previous 30d`
      : "No change";
  }
  return `${formatPercent(delta / previous)} vs previous 30d`;
};

const CompactMetric = ({
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
  <div className="flex min-w-0 items-start gap-3">
    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
    <div className="min-w-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {loading ? (
        <div className="mt-1 flex flex-col gap-1.5">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <div className="mt-1">
          <div className="text-xl font-semibold tabular-nums">{value}</div>
          {detail ? (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {detail}
            </div>
          ) : null}
        </div>
      )}
    </div>
  </div>
);

const InsightRow = ({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}) => (
  <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="truncate font-medium">{label}</div>
        {detail ? (
          <div className="truncate text-xs text-muted-foreground">{detail}</div>
        ) : null}
      </div>
    </div>
    <div className="shrink-0 font-semibold tabular-nums">{value}</div>
  </div>
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
  const overviewUnavailable =
    overviewQuery.isError || (!isLoading && !overview);
  const generatedDelta = overview
    ? overview.generatedAddresses.current - overview.generatedAddresses.previous
    : null;
  const integrationQueueCount = overview
    ? overview.integrations.retryScheduled + overview.integrations.failed
    : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="w-full rounded-lg border border-border/70 p-4">
        <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-10 w-36" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </>
            ) : overviewUnavailable ? (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className="size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-muted-foreground">
                      Platform status
                    </div>
                    <div className="text-lg font-semibold">Unknown</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InsightRow
                    icon={AlertTriangle}
                    label="Anomalies"
                    value="Unknown"
                  />
                  <InsightRow icon={RefreshCcw} label="Queue" value="Unknown" />
                </div>
              </>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  {overview!.system.status === "healthy" ? (
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                  ) : (
                    <AlertTriangle className="size-4 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-muted-foreground">
                      Platform status
                    </div>
                    <div className="text-lg font-semibold capitalize">
                      {overview!.system.status}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InsightRow
                    icon={AlertTriangle}
                    label="Anomalies"
                    value={formatNumber(overview!.anomalies.last24h)}
                  />
                  <InsightRow
                    icon={RefreshCcw}
                    label="Queue"
                    value={formatNumber(integrationQueueCount ?? 0)}
                  />
                </div>
              </>
            )}
          </div>

          <div
            className="grid gap-x-5 gap-y-4 border-t border-border/70 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 sm:grid-cols-2 xl:grid-cols-5"
            aria-label="Admin overview metrics"
          >
            <CompactMetric
              icon={Mailbox}
              label="Addresses"
              loading={isLoading}
              value={
                overview ? (
                  <NumberFlow value={overview.generatedAddresses.current} />
                ) : (
                  "Unknown"
                )
              }
              detail={
                generatedDelta === null
                  ? "Unavailable"
                  : `${formatSignedNumber(generatedDelta)} in 30d`
              }
            />
            <CompactMetric
              icon={Mail}
              label="Emails"
              loading={isLoading}
              value={
                overview ? (
                  <NumberFlow value={overview.receivedEmails.current} />
                ) : (
                  "Unknown"
                )
              }
              detail={
                overview
                  ? getTrendDetail(
                      overview.receivedEmails.current,
                      overview.receivedEmails.previous
                    )
                  : "Unavailable"
              }
            />
            <CompactMetric
              icon={Users}
              label="Users"
              loading={isLoading}
              value={
                overview ? <NumberFlow value={overview.users} /> : "Unknown"
              }
              detail={
                overview
                  ? `${formatNumber(overview.activeUsers24h)} active in 24h`
                  : "Unavailable"
              }
            />
            <CompactMetric
              icon={PlugZap}
              label="Active integrations"
              loading={isLoading}
              value={
                overview ? (
                  <NumberFlow value={overview.integrations.active} />
                ) : (
                  "Unknown"
                )
              }
            />
            <CompactMetric
              icon={Database}
              label="Organizations"
              loading={isLoading}
              value={
                overview ? (
                  <NumberFlow value={overview.organizations} />
                ) : (
                  "Unknown"
                )
              }
            />
          </div>
        </div>

        <Separator className="my-4" />

        <Card className="min-w-0 rounded-none bg-transparent py-0 ring-0">
          <CardHeader className="flex-row items-start justify-between px-0 pb-2 pt-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <HugeiconsIcon
                  icon={ChartAnalysisIcon}
                  strokeWidth={2}
                  className="size-4"
                />
                Activity
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {activityQuery.isLoading ? (
              <div className="flex h-[120px] items-end gap-2 px-2">
                {Array.from({ length: 14 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="w-full rounded-sm"
                    style={{ height: `${40 + ((index * 17) % 110)}px` }}
                  />
                ))}
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[135px] w-full">
                <BarChart data={daily} margin={{ top: 8, right: 12, left: 12 }}>
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
      </section>
    </div>
  );
};

const AdminUsersPanel = () => {
  const queryClient = useQueryClient();
  const { user: currentUser, refreshSession } = useAuth();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(
    null
  );
  const [selectedSessionUser, setSelectedSessionUser] =
    React.useState<AdminUser | null>(null);
  const [pendingAction, setPendingAction] =
    React.useState<PendingUserAction>(null);
  const [actionReason, setActionReason] = React.useState("");
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
      const reason = actionReason.trim() || undefined;
      if (action.type === "set-role") {
        await performAdminUserAction({
          action: "set-role",
          userId: action.user.id,
          role: action.role,
          ...(reason ? { reason } : {}),
        });
        return;
      }
      if (action.type === "ban") {
        await performAdminUserAction({
          action: "ban",
          userId: action.user.id,
          reason: reason || "Administrative action",
        });
        return;
      }
      if (action.type === "unban") {
        await performAdminUserAction({
          action: "unban",
          userId: action.user.id,
          ...(reason ? { reason } : {}),
        });
        return;
      }
      if (action.type === "impersonate") {
        await performAdminUserAction({
          action: "impersonate",
          userId: action.user.id,
          ...(reason ? { reason } : {}),
        });
        return;
      }
      await performAdminUserAction({
        action: "revoke-sessions",
        userId: action.user.id,
        ...(reason ? { reason } : {}),
      });
    },
    onSuccess: async (_data, action) => {
      const actedUserId = action.user.id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app", "admin", "users"] }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.adminUserSessions(actedUserId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.adminUserDetail(actedUserId),
        }),
      ]);
      setPendingAction(null);
      setActionReason("");
      if (action.type === "impersonate") {
        await refreshSession();
      }
    },
  });
  const revokeSessionMutation = useMutation({
    mutationFn: async ({
      sessionToken,
      userId,
    }: {
      sessionToken: string;
      userId: string;
    }) => {
      await performAdminUserAction({
        action: "revoke-session",
        userId,
        sessionToken,
      });
    },
    onSuccess: async (_data, action) => {
      const userId = action.userId;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminUserSessions(userId),
      });
    },
  });
  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  const canImpersonate = hasPlatformRole(
    (currentUser as { role?: unknown } | null)?.role,
    "admin"
  );

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
                <Select
                  value={getPrimaryPlatformRole(user.role)}
                  onValueChange={role =>
                    setPendingAction({
                      type: "set-role",
                      user,
                      role: role as (typeof PLATFORM_ROLE_OPTIONS)[number],
                    })
                  }
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`Role for ${user.email}`}
                  >
                    <KeyRound data-icon="inline-start" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PLATFORM_ROLE_OPTIONS.map(role => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <Eye data-icon="inline-start" />
                  Details
                </Button>
                {canImpersonate ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPendingAction({
                        type: "impersonate",
                        user,
                      })
                    }
                  >
                    Impersonate
                  </Button>
                ) : null}
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
          if (!open && !actionMutation.isPending) {
            setPendingAction(null);
            setActionReason("");
          }
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
          {pendingAction ? (
            <Input
              aria-label="Admin action reason"
              placeholder={
                pendingAction.type === "ban" ||
                pendingAction.type === "impersonate"
                  ? "Reason"
                  : "Reason (optional)"
              }
              value={actionReason}
              onChange={event => setActionReason(event.target.value)}
            />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                !pendingAction ||
                actionMutation.isPending ||
                ((pendingAction.type === "ban" ||
                  pendingAction.type === "impersonate") &&
                  !actionReason.trim())
              }
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
                            const userId = selectedSessionUser?.id ?? null;
                            const actedOnEmail =
                              selectedSessionUser?.email ?? "user";
                            if (!userId) return;
                            toast.promise(
                              revokeSessionMutation.mutateAsync({
                                sessionToken: session.token,
                                userId,
                              }),
                              {
                                loading: "Revoking session...",
                                success: `Revoked one session for ${actedOnEmail}.`,
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

      <UserDetailSheet
        userId={selectedUserId}
        onOpenChange={open => {
          if (!open) setSelectedUserId(null);
        }}
      />
    </div>
  );
};

const getActionTitle = (action: PendingUserAction) => {
  if (!action) return "Confirm action";
  if (action.type === "set-role") return `Set role to ${action.role}`;
  if (action.type === "ban") return "Ban user";
  if (action.type === "unban") return "Unban user";
  if (action.type === "impersonate") return "Impersonate user";
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
  if (action.type === "impersonate") {
    return `You will start a temporary session as ${action.user.email}. This is audited.`;
  }
  return `All active sessions for ${action.user.email} will be revoked.`;
};

const AdminOrganizationsPanel = () => {
  const [page, setPage] = React.useState(1);
  const [selectedOrganizationId, setSelectedOrganizationId] = React.useState<
    string | null
  >(null);
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
          "Actions",
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
            <TableCell>{formatNumber(org.receivedEmailCount)}</TableCell>
            <TableCell>
              {formatNumber(org.activeIntegrationCount)} /{" "}
              {formatNumber(org.integrationCount)}
            </TableCell>
            <TableCell>{formatDate(org.lastReceivedAt)}</TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedOrganizationId(org.id)}
              >
                <Eye data-icon="inline-start" />
                Details
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </AdminTableShell>
      <PaginationFooter
        page={page}
        totalPages={organizationsQuery.data?.totalPages ?? 0}
        onPrevious={() => setPage(value => Math.max(1, value - 1))}
        onNext={() => setPage(value => value + 1)}
      />
      <OrganizationDetailSheet
        organizationId={selectedOrganizationId}
        onOpenChange={open => {
          if (!open) setSelectedOrganizationId(null);
        }}
      />
    </div>
  );
};

const AdminAnomaliesPanel = () => {
  const [page, setPage] = React.useState(1);
  const [selectedEvent, setSelectedEvent] = React.useState<
    AdminOperationalEventsResponse["items"][number] | null
  >(null);
  const [severity, setSeverity] =
    React.useState<(typeof ANOMALY_SEVERITIES)[number]>("all");
  const [type, setType] = React.useState<(typeof ANOMALY_TYPES)[number]>("all");
  const [organizationId, setOrganizationId] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const anomaliesQuery = useQuery<AdminOperationalEventsResponse>({
    queryKey: queryKeys.adminAnomalies({
      page,
      pageSize: PAGE_SIZE,
      severity,
      type,
      organizationId,
      from: fromDate,
      to: toDate,
    }),
    queryFn: ({ signal }) =>
      listAdminAnomalies({
        page,
        pageSize: PAGE_SIZE,
        severity: severity === "all" ? undefined : severity,
        type: type === "all" ? undefined : type,
        organizationId: organizationId.trim() || undefined,
        from: fromDate ? `${fromDate}T00:00:00` : undefined,
        to: toDate ? `${toDate}T23:59:59.999` : undefined,
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
        columns={["Event", "Severity", "Organization", "Created", "Actions"]}
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
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEvent(event)}
              >
                <Eye data-icon="inline-start" />
                Details
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </AdminTableShell>
      <PaginationFooter
        page={page}
        totalPages={anomaliesQuery.data?.totalPages ?? 0}
        onPrevious={() => setPage(value => Math.max(1, value - 1))}
        onNext={() => setPage(value => value + 1)}
      />
      <OperationalEventSheet
        event={selectedEvent}
        onOpenChange={open => {
          if (!open) setSelectedEvent(null);
        }}
      />
    </div>
  );
};

const SeverityBadge = ({ severity }: { severity: string }) => {
  if (severity === "error") return <Badge variant="destructive">Error</Badge>;
  if (severity === "warning") return <Badge variant="secondary">Warning</Badge>;
  return <Badge variant="outline">Info</Badge>;
};

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="max-w-2xs text-right font-medium wrap-break-word">
      {value}
    </span>
  </div>
);

const JsonBlock = ({ value }: { value: unknown }) => (
  <pre className="max-h-64 overflow-auto rounded-md bg-muted/60 p-3 text-xs">
    {JSON.stringify(value ?? {}, null, 2)}
  </pre>
);

const UserDetailSheet = ({
  userId,
  onOpenChange,
}: {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const detailQuery = useQuery<AdminUserDetailResponse>({
    queryKey: queryKeys.adminUserDetail(userId),
    queryFn: ({ signal }) => getAdminUserDetail(userId ?? "", { signal }),
    enabled: Boolean(userId),
    staleTime: 15_000,
  });
  const detail = detailQuery.data;

  return (
    <Sheet open={Boolean(userId)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{detail?.user.email ?? "User detail"}</SheetTitle>
          <SheetDescription>
            Account, sessions, organizations, API keys, and recent audit events.
          </SheetDescription>
        </SheetHeader>
        {detailQuery.isLoading ? (
          <div className="flex flex-col gap-3 px-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-5 px-4 pb-6">
            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Account
              </p>
              <DetailRow label="Name" value={detail.user.name ?? "Unnamed"} />
              <DetailRow label="Role" value={detail.user.role ?? "user"} />
              <DetailRow
                label="Email verified"
                value={detail.user.emailVerified ? "Yes" : "No"}
              />
              <DetailRow
                label="Two-factor"
                value={detail.user.twoFactorEnabled ? "Enabled" : "Disabled"}
              />
              <DetailRow
                label="Status"
                value={detail.user.banned ? "Banned" : "Active"}
              />
              <DetailRow
                label="Created"
                value={formatDate(detail.user.createdAt)}
              />
            </section>

            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Organizations
              </p>
              {detail.memberships.length > 0 ? (
                detail.memberships.map(membership => (
                  <DetailRow
                    key={membership.organizationId}
                    label={membership.organizationName ?? "Organization"}
                    value={membership.role}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No memberships.</p>
              )}
            </section>

            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                API Keys
              </p>
              {detail.apiKeys.length > 0 ? (
                detail.apiKeys.map(key => (
                  <DetailRow
                    key={key.id}
                    label={key.name ?? key.start ?? key.id}
                    value={key.enabled === false ? "Disabled" : "Enabled"}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No API keys.</p>
              )}
            </section>

            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Recent Audit
              </p>
              {detail.recentEvents.length > 0 ? (
                detail.recentEvents.map(event => (
                  <DetailRow
                    key={event.id}
                    label={formatDate(event.createdAt)}
                    value={event.message}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No recent audit events.
                </p>
              )}
            </section>
          </div>
        ) : (
          <p className="px-4 text-sm text-muted-foreground">User not found.</p>
        )}
      </SheetContent>
    </Sheet>
  );
};

const OrganizationDetailSheet = ({
  organizationId,
  onOpenChange,
}: {
  organizationId: string | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const detailQuery = useQuery<AdminOrganizationDetailResponse>({
    queryKey: queryKeys.adminOrganizationDetail(organizationId),
    queryFn: ({ signal }) =>
      getAdminOrganizationDetail(organizationId ?? "", { signal }),
    enabled: Boolean(organizationId),
    staleTime: 15_000,
  });
  const detail = detailQuery.data;

  return (
    <Sheet open={Boolean(organizationId)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {detail?.organization.name ?? "Organization detail"}
          </SheetTitle>
          <SheetDescription>
            Members, invitations, integrations, API keys, and recent events.
          </SheetDescription>
        </SheetHeader>
        {detailQuery.isLoading ? (
          <div className="flex flex-col gap-3 px-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-5 px-4 pb-6">
            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Usage
              </p>
              <DetailRow label="Slug" value={detail.organization.slug} />
              <DetailRow
                label="Members"
                value={formatNumber(detail.organization.memberCount)}
              />
              <DetailRow
                label="Addresses"
                value={formatNumber(detail.organization.addressCount)}
              />
              <DetailRow
                label="Received"
                value={formatNumber(detail.organization.receivedEmailCount)}
              />
              <DetailRow
                label="Last mail"
                value={formatDate(detail.organization.lastReceivedAt)}
              />
            </section>

            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Members
              </p>
              {detail.members.map(member => (
                <DetailRow
                  key={member.id}
                  label={member.email ?? member.userId}
                  value={member.role}
                />
              ))}
            </section>

            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Invitations
              </p>
              {detail.invitations.length > 0 ? (
                detail.invitations.map(invitation => (
                  <DetailRow
                    key={invitation.id}
                    label={invitation.email}
                    value={invitation.status}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No invitations.</p>
              )}
            </section>

            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Integrations
              </p>
              {detail.integrations.length > 0 ? (
                detail.integrations.map(integration => (
                  <DetailRow
                    key={integration.id}
                    label={integration.name}
                    value={`${integration.provider} / ${integration.status}`}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No integrations.
                </p>
              )}
            </section>
          </div>
        ) : (
          <p className="px-4 text-sm text-muted-foreground">
            Organization not found.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
};

const OperationalEventSheet = ({
  event,
  onOpenChange,
}: {
  event: AdminOperationalEventsResponse["items"][number] | null;
  onOpenChange: (open: boolean) => void;
}) => (
  <Sheet open={Boolean(event)} onOpenChange={onOpenChange}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader>
        <SheetTitle>{event?.message ?? "Event detail"}</SheetTitle>
        <SheetDescription>{event?.type.replaceAll("_", " ")}</SheetDescription>
      </SheetHeader>
      {event ? (
        <div className="flex flex-col gap-4 px-4 pb-6">
          <DetailRow
            label="Severity"
            value={<SeverityBadge severity={event.severity} />}
          />
          <DetailRow label="Created" value={formatDate(event.createdAt)} />
          <DetailRow
            label="Organization"
            value={event.organizationName ?? event.organizationId ?? "System"}
          />
          <DetailRow label="Address ID" value={event.addressId ?? "None"} />
          <DetailRow label="Email ID" value={event.emailId ?? "None"} />
          <DetailRow
            label="Integration ID"
            value={event.integrationId ?? "None"}
          />
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Metadata
            </p>
            <JsonBlock value={event.metadata} />
          </div>
        </div>
      ) : null}
    </SheetContent>
  </Sheet>
);

const AdminApiKeysPanel = () => {
  const [page, setPage] = React.useState(1);
  const apiKeysQuery = useQuery<AdminApiKeysResponse>({
    queryKey: queryKeys.adminApiKeys(page, PAGE_SIZE),
    queryFn: ({ signal }) =>
      listAdminApiKeys({ page, pageSize: PAGE_SIZE, signal }),
    staleTime: 30_000,
  });
  const apiKeys = apiKeysQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AdminTableShell
        loading={apiKeysQuery.isLoading}
        columns={["Key", "Owner", "Status", "Requests", "Last used", "Expires"]}
      >
        {apiKeys.map(key => (
          <TableRow key={key.id}>
            <TableCell>
              <div className="flex min-w-48 flex-col">
                <span className="font-medium">{key.name ?? "Unnamed key"}</span>
                <span className="text-xs text-muted-foreground">
                  {key.prefix ?? ""}
                  {key.start ?? key.id}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span>{key.ownerLabel ?? key.referenceId}</span>
                <span className="text-xs text-muted-foreground">
                  {key.ownerType}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={key.enabled === false ? "secondary" : "default"}>
                {key.enabled === false ? "Disabled" : "Enabled"}
              </Badge>
            </TableCell>
            <TableCell>{formatNumber(key.requestCount)}</TableCell>
            <TableCell>{formatDate(key.lastRequest)}</TableCell>
            <TableCell>{formatDate(key.expiresAt)}</TableCell>
          </TableRow>
        ))}
      </AdminTableShell>
      <PaginationFooter
        page={page}
        totalPages={apiKeysQuery.data?.totalPages ?? 0}
        onPrevious={() => setPage(value => Math.max(1, value - 1))}
        onNext={() => setPage(value => value + 1)}
      />
    </div>
  );
};

const AdminAuditPanel = () => {
  const [page, setPage] = React.useState(1);
  const [type, setType] = React.useState<
    "admin_user_action" | "admin_session_action" | "admin_impersonation_started"
  >("admin_user_action");
  const severity = "info" as const;
  const [selectedEvent, setSelectedEvent] = React.useState<
    AdminOperationalEventsResponse["items"][number] | null
  >(null);
  const auditQuery = useQuery<AdminOperationalEventsResponse>({
    queryKey: queryKeys.adminAnomalies({
      page,
      pageSize: PAGE_SIZE,
      severity,
      type,
      organizationId: "",
      from: "",
      to: "",
    }),
    queryFn: ({ signal }) =>
      listAdminAnomalies({
        page,
        pageSize: PAGE_SIZE,
        severity,
        type,
        signal,
      }),
    staleTime: 15_000,
  });
  const events = auditQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Select
        value={type}
        onValueChange={value => {
          setPage(1);
          setType(value as typeof type);
        }}
      >
        <SelectTrigger size="sm" className="w-64" aria-label="Audit type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="admin_user_action">User actions</SelectItem>
            <SelectItem value="admin_session_action">
              Session actions
            </SelectItem>
            <SelectItem value="admin_impersonation_started">
              Impersonation
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <AdminTableShell
        loading={auditQuery.isLoading}
        columns={["Event", "Actor", "Target", "Created", "Actions"]}
      >
        {events.map(event => (
          <TableRow key={event.id}>
            <TableCell>{event.message}</TableCell>
            <TableCell>
              {typeof event.metadata?.actorEmail === "string"
                ? event.metadata.actorEmail
                : "Unknown"}
            </TableCell>
            <TableCell>
              {typeof event.metadata?.targetId === "string"
                ? event.metadata.targetId
                : "None"}
            </TableCell>
            <TableCell>{formatDate(event.createdAt)}</TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEvent(event)}
              >
                <Eye data-icon="inline-start" />
                Details
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </AdminTableShell>
      <PaginationFooter
        page={page}
        totalPages={auditQuery.data?.totalPages ?? 0}
        onPrevious={() => setPage(value => Math.max(1, value - 1))}
        onNext={() => setPage(value => value + 1)}
      />
      <OperationalEventSheet
        event={selectedEvent}
        onOpenChange={open => {
          if (!open) setSelectedEvent(null);
        }}
      />
    </div>
  );
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
  {
    id: "api-keys",
    label: "API Keys",
    icon: Key01Icon,
    content: <AdminApiKeysPanel />,
  },
  {
    id: "audit",
    label: "Audit",
    icon: LeftToRightListDashIcon,
    content: <AdminAuditPanel />,
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
