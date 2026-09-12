import { runAgentCli } from "@/cli";

describe("agent CLI", () => {
  it("reads enrollment secrets from the environment and writes one JSON result", async () => {
    const enroll = vi.fn().mockResolvedValue({ credentialToken: "shown-once" });
    const lines: string[] = [];
    const status = await runAgentCli({
      argv: ["enrollAgent"],
      input: JSON.stringify({
        body: { agentName: "mailer" },
        idempotencyKey: "enroll-cli-0001",
      }),
      environment: {
        SPINUPMAIL_ENROLLMENT_TOKEN: "secret-from-environment",
      },
      client: { enroll, execute: vi.fn() },
      write: line => lines.push(line),
    });

    expect(status).toBe(0);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      ok: true,
      operation: "enrollAgent",
      data: { credentialToken: "shown-once" },
    });
    expect(enroll).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentToken: "secret-from-environment" }),
      expect.objectContaining({ idempotencyKey: "enroll-cli-0001" })
    );
  });

  it("rejects command-line secrets", async () => {
    const lines: string[] = [];
    const status = await runAgentCli({
      argv: ["listInboxes", "--credential=secret"],
      input: "{}",
      write: line => lines.push(line),
    });

    expect(status).toBe(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ ok: false });
  });
});
