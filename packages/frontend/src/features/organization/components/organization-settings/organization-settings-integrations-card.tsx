import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { TelegramIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  INTEGRATION_MAX_PER_ORGANIZATION,
  TELEGRAM_BOT_NAME_MAX_LENGTH,
  TELEGRAM_BOT_TOKEN_MAX_LENGTH,
  TELEGRAM_BOT_TOKEN_REGEX,
  TELEGRAM_CHAT_ID_MAX_LENGTH,
  TELEGRAM_CHAT_ID_NUMERIC_REGEX,
  TELEGRAM_CHAT_USERNAME_REGEX,
} from "@spinupmail/contracts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeftIcon,
  type ChevronLeftIconHandle,
} from "@/components/ui/chevron-left";
import {
  ChevronRightIcon,
  type ChevronRightIconHandle,
} from "@/components/ui/chevron-right";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type {
  DeleteIntegrationResponse,
  IntegrationDispatch,
  OrganizationIntegrationSummary,
  ValidatedIntegrationConnection,
} from "@/lib/api";
import { useIntegrationDispatchesQuery } from "@/features/organization/hooks/use-integrations";

type OrganizationIntegrationsCardProps = {
  canManage: boolean;
  integrations?: OrganizationIntegrationSummary[];
  validationError: string | null;
  createError: string | null;
  isLoading?: boolean;
  isValidating: boolean;
  isCreating: boolean;
  isArchiving: boolean;
  onValidate: (payload: {
    name: string;
    botToken: string;
    chatId: string;
  }) => Promise<ValidatedIntegrationConnection>;
  onCreate: (payload: {
    name: string;
    botToken: string;
    chatId: string;
  }) => Promise<void>;
  onDelete: (integrationId: string) => Promise<DeleteIntegrationResponse>;
  onReplayDispatch: (payload: {
    integrationId: string;
    dispatchId: string;
  }) => Promise<{
    id: string;
    status: IntegrationDispatch["status"];
    replayed: true;
  }>;
};

type DispatchesPanelProps = {
  integrationId: string;
  replayingDispatchKey: string | null;
  onReplayDispatch: (payload: {
    integrationId: string;
    dispatchId: string;
  }) => Promise<{
    id: string;
    status: IntegrationDispatch["status"];
    replayed: true;
  }>;
  setReplayingDispatchKey: React.Dispatch<React.SetStateAction<string | null>>;
};

type IntegrationDraft = {
  name: string;
  botToken: string;
  chatId: string;
};

type DraftField = keyof IntegrationDraft;

const REPLAYABLE_STATUSES = new Set<IntegrationDispatch["status"]>([
  "failed_permanent",
  "failed_dlq",
]);

const STATUS_LABELS: Record<IntegrationDispatch["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  retry_scheduled: "Retry scheduled",
  sent: "Sent",
  failed_permanent: "Failed",
  failed_dlq: "Failed (DLQ)",
};

const STATUS_BADGE_CLASS: Record<IntegrationDispatch["status"], string> = {
  pending: "",
  processing: "",
  retry_scheduled: "",
  sent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed_permanent: "bg-red-500/10 text-red-700 dark:text-red-300",
  failed_dlq: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const formatDispatchTime = (dispatch: IntegrationDispatch) => {
  const timestamp =
    dispatch.deliveredAt ?? dispatch.nextAttemptAt ?? dispatch.createdAt;
  return timestamp
    ? new Date(timestamp).toLocaleString()
    : "Timestamp unavailable";
};

const validateDraftField = (field: DraftField, draft: IntegrationDraft) => {
  const name = draft.name.trim();
  const botToken = draft.botToken.trim();
  const chatId = draft.chatId.trim();

  if (field === "name") {
    if (!name) return "Integration name is required";
    if (name.length > TELEGRAM_BOT_NAME_MAX_LENGTH) {
      return `Integration name must be at most ${TELEGRAM_BOT_NAME_MAX_LENGTH} characters`;
    }
  }

  if (field === "botToken") {
    if (!botToken) return "Bot token is required";
    if (botToken.length > TELEGRAM_BOT_TOKEN_MAX_LENGTH) {
      return `Bot token must be at most ${TELEGRAM_BOT_TOKEN_MAX_LENGTH} characters`;
    }
    if (!TELEGRAM_BOT_TOKEN_REGEX.test(botToken)) {
      return "Bot token must look like 123456:ABC...";
    }
  }

  if (field === "chatId") {
    if (!chatId) return "Chat ID is required";
    if (chatId.length > TELEGRAM_CHAT_ID_MAX_LENGTH) {
      return `Chat ID must be at most ${TELEGRAM_CHAT_ID_MAX_LENGTH} characters`;
    }
    if (
      !(
        TELEGRAM_CHAT_ID_NUMERIC_REGEX.test(chatId) ||
        TELEGRAM_CHAT_USERNAME_REGEX.test(chatId)
      )
    ) {
      return "Chat ID must be a numeric ID or @username";
    }
  }

  return null;
};

const getDraftErrors = (draft: IntegrationDraft) => ({
  name: validateDraftField("name", draft),
  botToken: validateDraftField("botToken", draft),
  chatId: validateDraftField("chatId", draft),
});

const DispatchesPanel = ({
  integrationId,
  replayingDispatchKey,
  onReplayDispatch,
  setReplayingDispatchKey,
}: DispatchesPanelProps) => {
  const [page, setPage] = React.useState(1);
  const previousPageIconRef = React.useRef<ChevronLeftIconHandle>(null);
  const nextPageIconRef = React.useRef<ChevronRightIconHandle>(null);
  const dispatchesQuery = useIntegrationDispatchesQuery(
    integrationId,
    page,
    true
  );
  const dispatches = dispatchesQuery.data?.items ?? [];
  const totalPages = Math.max(1, dispatchesQuery.data?.totalPages ?? 1);
  const currentPage = Math.min(dispatchesQuery.data?.page ?? page, totalPages);
  const paginationPages = Array.from(
    { length: totalPages },
    (_, index) => index + 1
  );
  const isPaginationDisabled =
    dispatchesQuery.isPending || dispatchesQuery.isFetching;
  const isInitialLoading = dispatchesQuery.isPending && dispatches.length === 0;
  const errorMessage =
    dispatchesQuery.error instanceof Error
      ? dispatchesQuery.error.message
      : dispatchesQuery.error
        ? "Unable to load integration dispatches"
        : null;

  const handleReplay = async (dispatchId: string) => {
    const replayKey = `${integrationId}:${dispatchId}`;
    setReplayingDispatchKey(replayKey);
    try {
      await onReplayDispatch({ integrationId, dispatchId });
      toast.success("Dispatch queued for replay.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to replay dispatch"
      );
    } finally {
      setReplayingDispatchKey(current =>
        current === replayKey ? null : current
      );
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-background/70 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Recent dispatches
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={dispatchesQuery.isRefetching}
          onClick={() => void dispatchesQuery.refetch()}
        >
          Refresh
        </Button>
      </div>

      {isInitialLoading ? (
        <p className="text-xs text-muted-foreground">Loading dispatches...</p>
      ) : errorMessage ? (
        <p className="text-xs text-destructive">{errorMessage}</p>
      ) : dispatches.length > 0 ? (
        <div className="space-y-2">
          {dispatches.map(dispatch => {
            const replayKey = `${integrationId}:${dispatch.id}`;
            return (
              <div
                key={dispatch.id}
                className="flex flex-col gap-2 rounded-sm border border-border/70 p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_CLASS[dispatch.status]}
                    >
                      {STATUS_LABELS[dispatch.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Attempt {dispatch.attemptCount}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDispatchTime(dispatch)}
                  </p>
                  {dispatch.lastError ? (
                    <p className="text-xs text-destructive line-clamp-2">
                      {dispatch.lastError}
                    </p>
                  ) : null}
                </div>

                {REPLAYABLE_STATUSES.has(dispatch.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full sm:w-auto"
                    disabled={replayingDispatchKey === replayKey}
                    onClick={() => void handleReplay(dispatch.id)}
                  >
                    Replay
                  </Button>
                ) : null}
              </div>
            );
          })}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={currentPage <= 1 || isPaginationDisabled}
                onMouseEnter={() =>
                  previousPageIconRef.current?.startAnimation()
                }
                onMouseLeave={() =>
                  previousPageIconRef.current?.stopAnimation()
                }
                onClick={() => setPage(value => Math.max(1, value - 1))}
              >
                <ChevronLeftIcon ref={previousPageIconRef} size={14} />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {paginationPages.map(paginationPage => (
                  <Button
                    key={`integration-dispatches-page-${integrationId}-${paginationPage}`}
                    type="button"
                    variant={
                      paginationPage === currentPage ? "secondary" : "ghost"
                    }
                    size="sm"
                    className="h-7 min-w-7 px-2 text-xs"
                    disabled={isPaginationDisabled}
                    onClick={() => setPage(paginationPage)}
                  >
                    {paginationPage}
                  </Button>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={currentPage >= totalPages || isPaginationDisabled}
                onMouseEnter={() => nextPageIconRef.current?.startAnimation()}
                onMouseLeave={() => nextPageIconRef.current?.stopAnimation()}
                onClick={() =>
                  setPage(value => Math.min(totalPages, value + 1))
                }
              >
                Next
                <ChevronRightIcon ref={nextPageIconRef} size={14} />
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No dispatches yet.</p>
      )}
    </div>
  );
};

export const OrganizationIntegrationsCard = ({
  canManage,
  integrations,
  validationError,
  createError,
  isLoading = false,
  isValidating,
  isCreating,
  isArchiving,
  onValidate,
  onCreate,
  onDelete,
  onReplayDispatch,
}: OrganizationIntegrationsCardProps) => {
  const [draft, setDraft] = React.useState({
    name: "",
    botToken: "",
    chatId: "",
  });
  const [touchedFields, setTouchedFields] = React.useState<
    Record<DraftField, boolean>
  >({
    name: false,
    botToken: false,
    chatId: false,
  });
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [validated, setValidated] =
    React.useState<ValidatedIntegrationConnection | null>(null);
  const [isBotTokenVisible, setIsBotTokenVisible] = React.useState(false);
  const [integrationToArchive, setIntegrationToArchive] =
    React.useState<OrganizationIntegrationSummary | null>(null);
  const [expandedIntegrationIds, setExpandedIntegrationIds] = React.useState<
    Record<string, boolean>
  >({});
  const [replayingDispatchKey, setReplayingDispatchKey] = React.useState<
    string | null
  >(null);

  const draftErrors = getDraftErrors(draft);
  const draftError =
    draftErrors.name ?? draftErrors.botToken ?? draftErrors.chatId ?? null;
  const isValidatedDraft =
    validated?.provider === "telegram" &&
    validated.name.trim() === draft.name.trim() &&
    validated.publicConfig.chatId === draft.chatId.trim();
  const telegramIntegrations =
    integrations?.filter(integration => integration.provider === "telegram") ??
    [];
  const hasResolvedIntegrations = integrations !== undefined;

  const showFieldError = (field: DraftField) =>
    (submitAttempted || touchedFields[field]) && Boolean(draftErrors[field]);

  const handleDraftChange = (field: DraftField, value: string) => {
    setValidated(null);
    setDraft(current => ({
      ...current,
      [field]: value,
    }));
  };

  const handleFieldBlur = (field: DraftField) => {
    setTouchedFields(current => ({
      ...current,
      [field]: true,
    }));
  };

  const handleValidate = async () => {
    setSubmitAttempted(true);
    if (draftError) {
      toast.error(draftError);
      return;
    }

    try {
      const result = await onValidate(draft);
      setValidated(result);
      toast.success("Telegram connection validated.");
    } catch (error) {
      setValidated(null);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to validate integration"
      );
    }
  };

  const handleCreate = async () => {
    setSubmitAttempted(true);
    if (draftError) {
      toast.error(draftError);
      return;
    }
    if (!isValidatedDraft) {
      toast.error("Validate the connection before saving this integration.");
      return;
    }

    try {
      await onCreate(draft);
      setDraft({
        name: "",
        botToken: "",
        chatId: "",
      });
      setIsBotTokenVisible(false);
      setTouchedFields({
        name: false,
        botToken: false,
        chatId: false,
      });
      setSubmitAttempted(false);
      setValidated(null);
      toast.success("Telegram integration saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save integration"
      );
    }
  };

  const toggleDispatchesPanel = (integrationId: string) => {
    const currentlyExpanded = Boolean(expandedIntegrationIds[integrationId]);
    setExpandedIntegrationIds(current => ({
      ...current,
      [integrationId]: !currentlyExpanded,
    }));
  };

  const previewName = draft.name.trim() || "Telegram integration";
  const previewChat =
    (validated?.provider === "telegram"
      ? (validated.publicConfig.chatLabel ?? validated.publicConfig.chatId)
      : null) ||
    draft.chatId.trim() ||
    "-1001234567890";
  const previewBotIdentity =
    validated?.provider === "telegram"
      ? `@${validated.publicConfig.botUsername}`
      : "Bot identity will appear after validation";

  return (
    <>
      <Card className="border-border/70 bg-card/60">
        <CardHeader className="space-y-1 border-b border-border/70 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-[15px]">Integrations</CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {canManage ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <HugeiconsIcon
                    icon={TelegramIcon}
                    className="size-4 text-muted-foreground"
                  />
                  <p className="text-sm font-medium">
                    Add Telegram integration
                  </p>
                </div>

                <FieldGroup>
                  <div className="grid gap-3">
                    <Field>
                      <FieldLabel htmlFor="integration-name">Name</FieldLabel>
                      <Input
                        id="integration-name"
                        placeholder="Ops alerts"
                        value={draft.name}
                        maxLength={TELEGRAM_BOT_NAME_MAX_LENGTH}
                        onBlur={() => handleFieldBlur("name")}
                        onChange={event =>
                          handleDraftChange("name", event.target.value)
                        }
                      />
                      {showFieldError("name") ? (
                        <FieldError errors={[{ message: draftErrors.name! }]} />
                      ) : null}
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="integration-bot-token">
                        Bot token
                      </FieldLabel>
                      <div className="relative">
                        <Input
                          id="integration-bot-token"
                          type={isBotTokenVisible ? "text" : "password"}
                          autoComplete="new-password"
                          className="pr-10"
                          placeholder="123456789:AAExampleBotToken"
                          value={draft.botToken}
                          maxLength={TELEGRAM_BOT_TOKEN_MAX_LENGTH}
                          onBlur={() => handleFieldBlur("botToken")}
                          onChange={event =>
                            handleDraftChange("botToken", event.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
                          aria-label={
                            isBotTokenVisible
                              ? "Hide bot token"
                              : "Show bot token"
                          }
                          onClick={() =>
                            setIsBotTokenVisible(current => !current)
                          }
                        >
                          {isBotTokenVisible ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                      {showFieldError("botToken") ? (
                        <FieldError
                          errors={[{ message: draftErrors.botToken! }]}
                        />
                      ) : null}
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="integration-chat-id">
                        Chat ID
                      </FieldLabel>
                      <Input
                        id="integration-chat-id"
                        placeholder="-1001234567890 or @ops_room"
                        value={draft.chatId}
                        maxLength={TELEGRAM_CHAT_ID_MAX_LENGTH}
                        onBlur={() => handleFieldBlur("chatId")}
                        onChange={event =>
                          handleDraftChange("chatId", event.target.value)
                        }
                      />
                      {showFieldError("chatId") ? (
                        <FieldError
                          errors={[{ message: draftErrors.chatId! }]}
                        />
                      ) : null}
                    </Field>
                  </div>

                  {validationError ? (
                    <FieldError errors={[{ message: validationError }]} />
                  ) : null}
                  {createError ? (
                    <FieldError errors={[{ message: createError }]} />
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isValidating}
                      onClick={() => void handleValidate()}
                    >
                      Validate
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        isCreating ||
                        telegramIntegrations.length >=
                          INTEGRATION_MAX_PER_ORGANIZATION
                      }
                      onClick={() => void handleCreate()}
                    >
                      Save Integration
                    </Button>
                  </div>
                </FieldGroup>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Preview</p>
                  <Badge variant="outline">
                    {isValidatedDraft ? "Validated" : "Draft"}
                  </Badge>
                </div>

                <div className="space-y-3 rounded-md border border-border/70 bg-muted/25 p-3">
                  <div className="space-y-1">
                    <p className="font-medium">{previewName}</p>
                    <p className="text-sm text-muted-foreground">
                      Telegram delivery for mailbox events
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground/80">
                        Bot
                      </p>
                      <p>{previewBotIdentity}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground/80">
                        Destination
                      </p>
                      <p>{previewChat}</p>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {isValidatedDraft
                    ? "The current draft matches a validated Telegram connection."
                    : "Validate the bot token and chat before saving to confirm the final bot identity."}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only organization owners and admins can manage integrations.
            </p>
          )}

          <Separator />

          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading integrations...
            </p>
          ) : telegramIntegrations.length > 0 ? (
            <div className="space-y-3">
              {telegramIntegrations.map(integration => {
                const isExpanded = Boolean(
                  expandedIntegrationIds[integration.id]
                );
                return (
                  <div
                    key={integration.id}
                    className="rounded-lg border border-border/70 bg-background/70 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{integration.name}</p>
                          <Badge variant="outline">Telegram</Badge>
                          <Badge variant="outline">
                            {integration.status === "active"
                              ? "Active"
                              : "Archived"}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>@{integration.publicConfig.botUsername}</p>
                          <p>
                            {integration.publicConfig.chatLabel ??
                              integration.publicConfig.chatId}
                          </p>
                          <p>{integration.mailboxCount} mailbox assignments</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleDispatchesPanel(integration.id)}
                        >
                          {isExpanded ? "Hide Dispatches" : "Show Dispatches"}
                        </Button>
                        {canManage ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isArchiving}
                            onClick={() => setIntegrationToArchive(integration)}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="mt-3">
                        <DispatchesPanel
                          integrationId={integration.id}
                          replayingDispatchKey={replayingDispatchKey}
                          onReplayDispatch={onReplayDispatch}
                          setReplayingDispatchKey={setReplayingDispatchKey}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : hasResolvedIntegrations ? (
            <p className="text-sm text-muted-foreground">
              No integrations yet.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog
        open={integrationToArchive !== null}
        onOpenChange={open => {
          if (!open) setIntegrationToArchive(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the integration and all related data,
              including mailbox assignments, dispatch history, and delivery
              attempts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!integrationToArchive) return;
                try {
                  const result = await onDelete(integrationToArchive.id);
                  toast.success(
                    result.deletedDispatchCount > 0 ||
                      result.clearedMailboxCount > 0
                      ? `Integration deleted. Removed ${result.clearedMailboxCount} mailbox assignments and ${result.deletedDispatchCount} dispatches.`
                      : "Integration deleted."
                  );
                  setIntegrationToArchive(null);
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Unable to delete integration"
                  );
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
