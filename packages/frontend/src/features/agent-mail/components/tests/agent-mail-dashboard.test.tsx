import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentMailDashboard } from "@/features/agent-mail/components/agent-mail-dashboard";
import { useAgentMail } from "@/features/agent-mail/hooks/use-agent-mail";

vi.mock("@/features/agent-mail/hooks/use-agent-mail", () => ({
  useAgentMail: vi.fn(),
}));

const mockedUseAgentMail = vi.mocked(useAgentMail);
const enrollmentMutateAsync = vi.fn();
const approveMutate = vi.fn();
const setSendingMutate = vi.fn();
const setFleetMutate = vi.fn();

const query = <T,>(data: T) => ({
  data,
  isLoading: false,
  error: null,
});

const buildMailState = (overrides: Record<string, unknown> = {}) =>
  ({
    organizationId: "org-1",
    capabilities: query({
      version: "1",
      organizationId: "org-1",
      actor: "human",
      admin: true,
      platformAdmin: true,
      twoFactorEnabled: true,
      capabilities: [],
      sending: false,
    }),
    canManage: true,
    isOperator: true,
    principals: query({ items: [] }),
    credentials: query({ items: [] }),
    inboxes: query({ items: [], nextCursor: null }),
    threads: query({ items: [], nextCursor: null }),
    thread: query(undefined),
    drafts: query({ items: [], nextCursor: null }),
    submissions: query({ items: [], nextCursor: null }),
    policy: query({
      policy: {
        sendingEnabled: false,
        suspendedAt: null,
        suspensionReason: null,
        updatedAt: null,
      },
      recipientRules: [],
    }),
    usage: query({
      usage: {
        period: "2026-09",
        reservedRecipients: 0,
        submittedRecipients: 0,
        updatedAt: null,
      },
      entitlement: {
        status: "inactive",
        monthlyRecipientLimit: 0,
        storageByteLimit: 0,
        updatedAt: null,
      },
    }),
    fleet: query({
      control: {
        sendingEnabled: false,
        updatedByUserId: null,
        updatedAt: null,
      },
    }),
    enrollment: {
      mutateAsync: enrollmentMutateAsync,
      isPending: false,
      error: null,
    },
    revokePrincipal: { mutate: vi.fn() },
    revokeCredential: { mutate: vi.fn() },
    approveDraft: { mutate: approveMutate },
    setSending: { mutate: setSendingMutate, isPending: false },
    setFleet: { mutate: setFleetMutate, isPending: false },
    ...overrides,
  }) as unknown as ReturnType<typeof useAgentMail>;

describe("AgentMailDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enrollmentMutateAsync.mockResolvedValue({
      enrollment: { id: "enrollment-1", expiresAt: Date.now() + 900_000 },
      enrollmentToken: "smenr_v1_enrollment-1.shown-once",
    });
    mockedUseAgentMail.mockReturnValue(buildMailState());
  });

  it("shows a new enrollment token once and clears it", async () => {
    const user = userEvent.setup();
    render(<AgentMailDashboard />);

    await user.click(screen.getByRole("button", { name: "Create enrollment" }));
    expect(
      (await screen.findByLabelText("Enrollment token")).textContent
    ).toContain("shown-once");
    expect(enrollmentMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Mailbox agent", inboxLimit: 1 })
    );

    await user.click(screen.getByRole("button", { name: "Clear token" }));
    expect(screen.queryByLabelText("Enrollment token")).toBeNull();
  });

  it("keeps disabled sending explicit and delegates both kill switches to the API", () => {
    render(<AgentMailDashboard />);

    expect(screen.getByText("Disabled")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Workspace sending" }));
    fireEvent.click(screen.getByRole("switch", { name: "Fleet kill switch" }));
    expect(setSendingMutate).toHaveBeenCalledWith(true);
    expect(setFleetMutate).toHaveBeenCalledWith(true);
  });

  it("approves only the displayed draft version", async () => {
    mockedUseAgentMail.mockReturnValue(
      buildMailState({
        drafts: query({
          items: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              inboxId: "00000000-0000-4000-8000-000000000002",
              threadId: null,
              to: ["person@example.com"],
              cc: [],
              bcc: [],
              subject: "Review me",
              bodyText: "Hello",
              bodyHtml: null,
              inReplyTo: null,
              references: [],
              version: 4,
              contentHash: "a".repeat(64),
              approvedHash: null,
              approvedAt: null,
              submittedAt: null,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
          nextCursor: null,
        }),
      })
    );
    const user = userEvent.setup();
    render(<AgentMailDashboard />);

    await user.click(
      screen.getByRole("button", { name: "Approve exact draft" })
    );
    await waitFor(() =>
      expect(approveMutate).toHaveBeenCalledWith({
        id: "00000000-0000-4000-8000-000000000001",
        version: 4,
      })
    );
  });

  it("uses the server-reported admin boundary", () => {
    mockedUseAgentMail.mockReturnValue(
      buildMailState({ canManage: false, isOperator: false })
    );
    render(<AgentMailDashboard />);

    expect(
      screen.getByText(/workspace owner or administrator is required/i)
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Create enrollment" })
    ).toBeNull();
  });
});
