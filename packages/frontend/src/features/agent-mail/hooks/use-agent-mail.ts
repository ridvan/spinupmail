import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  approveAgentDraft,
  createAgentEnrollment,
  getAgentCapabilities,
  getAgentFleetControl,
  getAgentSendingPolicy,
  getAgentThread,
  getAgentUsage,
  listAgentCredentials,
  listAgentDrafts,
  listAgentInboxes,
  listAgentPrincipals,
  listAgentSubmissions,
  listAgentThreads,
  revokeAgentCredential,
  revokeAgentPrincipal,
  updateAgentFleetControl,
  updateAgentSendingPolicy,
} from "@/lib/api";

export const agentMailKeys = {
  root: (organizationId: string | null) =>
    ["agent-mail", organizationId] as const,
  capabilities: (organizationId: string | null) =>
    [...agentMailKeys.root(organizationId), "capabilities"] as const,
  principals: (organizationId: string | null) =>
    [...agentMailKeys.root(organizationId), "principals"] as const,
  credentials: (organizationId: string | null) =>
    [...agentMailKeys.root(organizationId), "credentials"] as const,
  inboxes: (organizationId: string | null) =>
    [...agentMailKeys.root(organizationId), "inboxes"] as const,
  threads: (organizationId: string | null, inboxId: string | null) =>
    [...agentMailKeys.root(organizationId), "threads", inboxId] as const,
  thread: (organizationId: string | null, threadId: string | null) =>
    [...agentMailKeys.root(organizationId), "thread", threadId] as const,
  drafts: (organizationId: string | null, inboxId: string | null) =>
    [...agentMailKeys.root(organizationId), "drafts", inboxId] as const,
  submissions: (organizationId: string | null, inboxId: string | null) =>
    [...agentMailKeys.root(organizationId), "submissions", inboxId] as const,
  policy: (organizationId: string | null) =>
    [...agentMailKeys.root(organizationId), "policy"] as const,
  usage: (organizationId: string | null) =>
    [...agentMailKeys.root(organizationId), "usage"] as const,
  fleet: (organizationId: string | null) =>
    [...agentMailKeys.root(organizationId), "fleet"] as const,
};

export const useAgentMail = (
  inboxId: string | null,
  threadId: string | null
) => {
  const { activeOrganizationId } = useAuth();
  const organizationId = activeOrganizationId;
  const queryClient = useQueryClient();
  const capabilities = useQuery({
    queryKey: agentMailKeys.capabilities(organizationId),
    queryFn: ({ signal }) => getAgentCapabilities(organizationId!, signal),
    enabled: Boolean(organizationId),
  });
  const canManage = capabilities.data?.admin === true;
  const isOperator = capabilities.data?.platformAdmin === true;
  const principals = useQuery({
    queryKey: agentMailKeys.principals(organizationId),
    queryFn: ({ signal }) => listAgentPrincipals(organizationId!, signal),
    enabled: Boolean(organizationId && canManage),
  });
  const credentials = useQuery({
    queryKey: agentMailKeys.credentials(organizationId),
    queryFn: ({ signal }) => listAgentCredentials(organizationId!, signal),
    enabled: Boolean(organizationId && canManage),
  });
  const inboxes = useQuery({
    queryKey: agentMailKeys.inboxes(organizationId),
    queryFn: ({ signal }) => listAgentInboxes(organizationId!, signal),
    enabled: Boolean(organizationId && canManage),
  });
  const threads = useQuery({
    queryKey: agentMailKeys.threads(organizationId, inboxId),
    queryFn: ({ signal }) =>
      listAgentThreads(inboxId!, organizationId!, signal),
    enabled: Boolean(organizationId && canManage && inboxId),
  });
  const thread = useQuery({
    queryKey: agentMailKeys.thread(organizationId, threadId),
    queryFn: ({ signal }) => getAgentThread(threadId!, organizationId!, signal),
    enabled: Boolean(organizationId && canManage && threadId),
  });
  const drafts = useQuery({
    queryKey: agentMailKeys.drafts(organizationId, inboxId),
    queryFn: ({ signal }) => listAgentDrafts(inboxId!, organizationId!, signal),
    enabled: Boolean(organizationId && canManage && inboxId),
  });
  const submissions = useQuery({
    queryKey: agentMailKeys.submissions(organizationId, inboxId),
    queryFn: ({ signal }) =>
      listAgentSubmissions(inboxId!, organizationId!, signal),
    enabled: Boolean(organizationId && canManage && inboxId),
  });
  const policy = useQuery({
    queryKey: agentMailKeys.policy(organizationId),
    queryFn: ({ signal }) => getAgentSendingPolicy(organizationId!, signal),
    enabled: Boolean(organizationId && canManage),
  });
  const usage = useQuery({
    queryKey: agentMailKeys.usage(organizationId),
    queryFn: ({ signal }) => getAgentUsage(organizationId!, signal),
    enabled: Boolean(organizationId && canManage),
  });
  const fleet = useQuery({
    queryKey: agentMailKeys.fleet(organizationId),
    queryFn: ({ signal }) => getAgentFleetControl(organizationId!, signal),
    enabled: Boolean(organizationId && isOperator),
  });
  const invalidateRoot = () =>
    queryClient.invalidateQueries({
      queryKey: agentMailKeys.root(organizationId),
    });

  const enrollment = useMutation({
    mutationFn: (input: Parameters<typeof createAgentEnrollment>[0]) =>
      createAgentEnrollment(input, organizationId!),
    onSuccess: invalidateRoot,
  });
  const revokePrincipal = useMutation({
    mutationFn: (id: string) => revokeAgentPrincipal(id, organizationId!),
    onSuccess: invalidateRoot,
  });
  const revokeCredential = useMutation({
    mutationFn: (id: string) => revokeAgentCredential(id, organizationId!),
    onSuccess: invalidateRoot,
  });
  const approveDraft = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      approveAgentDraft(id, version, organizationId!),
    onSuccess: invalidateRoot,
  });
  const setSending = useMutation({
    mutationFn: (sendingEnabled: boolean) =>
      updateAgentSendingPolicy(
        {
          sendingEnabled,
          recipientRules: policy.data?.recipientRules ?? [],
        },
        organizationId!
      ),
    onSuccess: invalidateRoot,
  });
  const setFleet = useMutation({
    mutationFn: (sendingEnabled: boolean) =>
      updateAgentFleetControl(sendingEnabled, organizationId!),
    onSuccess: invalidateRoot,
  });

  return {
    organizationId,
    capabilities,
    canManage,
    isOperator,
    principals,
    credentials,
    inboxes,
    threads,
    thread,
    drafts,
    submissions,
    policy,
    usage,
    fleet,
    enrollment,
    revokePrincipal,
    revokeCredential,
    approveDraft,
    setSending,
    setFleet,
  };
};
