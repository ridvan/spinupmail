import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { setLastActiveOrganizationId } from "@/features/organization/utils/active-organization-storage";
import { createOrganizationWithGeneratedSlug } from "@/features/organization/utils/create-organization";
import { listOrganizationStats } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";

export type OrganizationItem = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

export type OrganizationMember = {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
};

export type OrganizationInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  organizationName?: string;
  inviterEmail?: string;
};

export type ActiveOrganization = OrganizationItem & {
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
};

const organizationQueryKeys = {
  organizations: ["auth", "organizations"] as const,
  active: ["auth", "organization", "active"] as const,
  invitation: (invitationId: string | null) =>
    ["auth", "organization", "invitation", invitationId] as const,
  members: (organizationId: string | null) =>
    ["auth", "organization", organizationId, "members"] as const,
  invitations: (organizationId: string | null) =>
    ["auth", "organization", organizationId, "invitations"] as const,
  userInvitations: ["auth", "organization", "user-invitations"] as const,
};

const toError = (message: string | undefined, fallback: string) =>
  new Error(message || fallback);

const invalidateOrganizationQueries = async (
  queryClient: ReturnType<typeof useQueryClient>
) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: organizationQueryKeys.organizations,
    }),
    queryClient.invalidateQueries({ queryKey: organizationQueryKeys.active }),
    queryClient.invalidateQueries({ queryKey: ["auth", "organization"] }),
  ]);
};

export const useOrganizationsQuery = () => {
  return useQuery({
    queryKey: organizationQueryKeys.organizations,
    queryFn: async () => {
      const result = await authClient.organization.list();
      if (result.error) {
        throw toError(result.error.message, "Unable to load organizations");
      }
      return (result.data ?? []) as OrganizationItem[];
    },
    staleTime: 15_000,
  });
};

export const useOrganizationStatsQuery = () => {
  return useQuery({
    queryKey: queryKeys.organizationStats,
    queryFn: ({ signal }) => listOrganizationStats({ signal }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
};

export const useActiveOrganizationQuery = () => {
  const { activeOrganizationId } = useAuth();

  return useQuery({
    queryKey: organizationQueryKeys.active,
    queryFn: async () => {
      const result = await authClient.organization.getFullOrganization();
      if (result.error) {
        throw toError(
          result.error.message,
          "Unable to load active organization"
        );
      }
      return (result.data ?? null) as ActiveOrganization | null;
    },
    enabled: Boolean(activeOrganizationId),
    staleTime: 10_000,
  });
};

export const useOrganizationInvitationQuery = (invitationId: string | null) => {
  return useQuery({
    queryKey: organizationQueryKeys.invitation(invitationId),
    queryFn: async () => {
      if (!invitationId) return null;
      const result = await authClient.organization.getInvitation({
        query: {
          id: invitationId,
        },
      });
      if (result.error) {
        throw toError(result.error.message, "Unable to load invitation");
      }
      return (result.data ?? null) as
        | (OrganizationInvitation & {
            organizationName: string;
            inviterEmail: string;
          })
        | null;
    },
    enabled: Boolean(invitationId),
    staleTime: 10_000,
  });
};

export const useOrganizationMembersQuery = (enabled = true) => {
  const { activeOrganizationId } = useAuth();

  return useQuery({
    queryKey: organizationQueryKeys.members(activeOrganizationId),
    queryFn: async () => {
      const result = await authClient.organization.listMembers();
      if (result.error) {
        throw toError(result.error.message, "Unable to load members");
      }
      return (result.data?.members ?? []) as OrganizationMember[];
    },
    enabled: Boolean(activeOrganizationId && enabled),
    staleTime: 10_000,
  });
};

export const useOrganizationInvitationsQuery = (enabled = true) => {
  const { activeOrganizationId } = useAuth();

  return useQuery({
    queryKey: organizationQueryKeys.invitations(activeOrganizationId),
    queryFn: async () => {
      const result = await authClient.organization.listInvitations();
      if (result.error) {
        throw toError(result.error.message, "Unable to load invitations");
      }
      return (result.data ?? []) as OrganizationInvitation[];
    },
    enabled: Boolean(activeOrganizationId && enabled),
    staleTime: 10_000,
  });
};

export const useUserInvitationsQuery = () => {
  return useQuery({
    queryKey: organizationQueryKeys.userInvitations,
    queryFn: async () => {
      const result = await authClient.organization.listUserInvitations();
      if (result.error) {
        throw toError(result.error.message, "Unable to load your invitations");
      }
      return (result.data ?? []) as OrganizationInvitation[];
    },
    staleTime: 10_000,
  });
};

export const useCreateOrganizationMutation = () => {
  const queryClient = useQueryClient();
  const { refreshSession } = useAuth();

  return useMutation({
    mutationFn: (name: string) => createOrganizationWithGeneratedSlug(name),
    onSuccess: async () => {
      await refreshSession();
      await invalidateOrganizationQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["app"] });
    },
  });
};

export const useSetActiveOrganizationMutation = () => {
  const queryClient = useQueryClient();
  const {
    activeOrganizationId,
    beginOrganizationSwitch,
    completeOrganizationSwitch,
    cancelOrganizationSwitch,
    refreshSession,
  } = useAuth();

  return useMutation({
    onMutate: (organizationId: string) => {
      beginOrganizationSwitch(organizationId);
      void queryClient.cancelQueries({ queryKey: ["app"] });
      queryClient.removeQueries({ queryKey: ["app"] });

      return {
        previousOrganizationId: activeOrganizationId,
      };
    },
    mutationFn: async (organizationId: string) => {
      const result = await authClient.organization.setActive({
        organizationId,
      });
      if (result.error) {
        throw toError(result.error.message, "Unable to switch organization");
      }
      return result.data;
    },
    onSuccess: async (_data, organizationId) => {
      setLastActiveOrganizationId(organizationId);
      await refreshSession();
      completeOrganizationSwitch();
      await invalidateOrganizationQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["app"] });
    },
    onError: async (_error, _organizationId, context) => {
      if (context?.previousOrganizationId) {
        cancelOrganizationSwitch(context.previousOrganizationId);
      } else {
        cancelOrganizationSwitch(null);
      }
      await refreshSession();
    },
  });
};

export const useAcceptInvitationMutation = () => {
  const queryClient = useQueryClient();
  const { refreshSession } = useAuth();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (result.error) {
        throw toError(result.error.message, "Unable to accept invitation");
      }
      return result.data;
    },
    onSuccess: async () => {
      await refreshSession();
      await invalidateOrganizationQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["app"] });
    },
  });
};

export const useUpdateOrganizationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const result = await authClient.organization.update({
        data: {
          name: name.trim(),
        },
      });
      if (result.error) {
        throw toError(result.error.message, "Unable to update organization");
      }
      return result.data;
    },
    onSuccess: async () => {
      await invalidateOrganizationQueries(queryClient);
    },
  });
};

export const useInviteMemberMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      email: string;
      role: "member" | "admin";
    }) => {
      const result = await authClient.organization.inviteMember({
        email: payload.email.trim(),
        role: payload.role,
      });
      if (result.error) {
        throw toError(result.error.message, "Unable to invite member");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["auth", "organization"],
      });
    },
  });
};

export const useCancelInvitationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if (result.error) {
        throw toError(result.error.message, "Unable to cancel invitation");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["auth", "organization"],
      });
    },
  });
};

export const useUpdateMemberRoleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      memberId: string;
      role: "member" | "admin";
    }) => {
      const result = await authClient.organization.updateMemberRole({
        memberId: payload.memberId,
        role: payload.role,
      });
      if (result.error) {
        throw toError(result.error.message, "Unable to update member role");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["auth", "organization"],
      });
    },
  });
};

export const useRemoveMemberMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const result = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
      });
      if (result.error) {
        throw toError(result.error.message, "Unable to remove member");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["auth", "organization"],
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organizationStats,
      });
    },
  });
};
