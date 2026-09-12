#!/usr/bin/env node
import { agentOperations, type AgentOperationName } from "@/contracts";
import {
  SpinupMailAgentClient,
  type AgentCallInput,
  type CreateAgentClientOptions,
} from "@/agent-client";

type AgentExecutor = Pick<SpinupMailAgentClient, "execute" | "enroll">;

export type AgentCliOptions = {
  argv?: string[];
  input?: string;
  environment?: Record<string, string | undefined>;
  write?: (line: string) => void;
  client?: AgentExecutor;
};

const readStandardInput = async () => {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

const commandHelp = () => ({
  usage: "spinupmail-agent <operation> < request.json",
  input: "JSON request envelope on stdin",
  secrets: [
    "SPINUPMAIL_AGENT_CREDENTIAL",
    "SPINUPMAIL_ENROLLMENT_TOKEN (enrollAgent only)",
  ],
  operations: Object.entries(agentOperations)
    .filter(([, definition]) =>
      ["agent", "human-or-agent", "enrollment-token"].includes(definition.auth)
    )
    .map(([name, definition]) => ({
      name,
      method: definition.method,
      path: definition.path,
      summary: definition.summary,
    })),
});

const serializeError = (error: unknown) => ({
  name: error instanceof Error ? error.name : "Error",
  message: error instanceof Error ? error.message : "Unknown error",
  ...(typeof error === "object" && error && "status" in error
    ? { status: (error as { status: unknown }).status }
    : {}),
});

const parsePayload = (text: string): AgentCallInput => {
  if (!text.trim()) return {};
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CLI input must be a JSON object.");
  }
  return value as AgentCallInput;
};

const normalizeOutput = (value: unknown) =>
  value instanceof Uint8Array
    ? { encoding: "base64", data: Buffer.from(value).toString("base64") }
    : value;

export const runAgentCli = async (options: AgentCliOptions = {}) => {
  const argv = options.argv ?? process.argv.slice(2);
  const environment = options.environment ?? process.env;
  const write = options.write ?? (line => process.stdout.write(`${line}\n`));
  if (
    argv.some(value => /^--(?:credential|enrollment-token)(?:=|$)/.test(value))
  ) {
    write(
      JSON.stringify({
        ok: false,
        error: {
          message:
            "Secrets must be supplied through environment configuration.",
        },
      })
    );
    return 2;
  }
  const command = argv[0];
  if (!command || command === "help" || command === "--help") {
    write(JSON.stringify({ ok: true, data: commandHelp() }));
    return 0;
  }
  if (!(command in agentOperations)) {
    write(
      JSON.stringify({
        ok: false,
        error: { message: `Unknown operation: ${command}` },
      })
    );
    return 2;
  }
  const name = command as AgentOperationName;
  const definition = agentOperations[name];
  if (
    !["agent", "human-or-agent", "enrollment-token"].includes(definition.auth)
  ) {
    write(
      JSON.stringify({
        ok: false,
        error: { message: "This operation is not available in the agent CLI." },
      })
    );
    return 2;
  }

  try {
    const payload = parsePayload(options.input ?? (await readStandardInput()));
    const client =
      options.client ??
      new SpinupMailAgentClient({
        baseUrl: environment.SPINUPMAIL_BASE_URL,
        credential: environment.SPINUPMAIL_AGENT_CREDENTIAL,
        organizationId: environment.SPINUPMAIL_ORGANIZATION_ID,
      } satisfies CreateAgentClientOptions);
    const data =
      name === "enrollAgent"
        ? await client.enroll(
            {
              ...((payload.body ?? {}) as Omit<
                Parameters<SpinupMailAgentClient["enroll"]>[0],
                "enrollmentToken"
              >),
              enrollmentToken:
                environment.SPINUPMAIL_ENROLLMENT_TOKEN ??
                (() => {
                  throw new Error("SPINUPMAIL_ENROLLMENT_TOKEN is required.");
                })(),
            },
            {
              idempotencyKey:
                payload.idempotencyKey ??
                (() => {
                  throw new Error("idempotencyKey is required.");
                })(),
              signal: payload.signal,
              timeoutMs: payload.timeoutMs,
            }
          )
        : await client.execute(name, payload);
    write(
      JSON.stringify({ ok: true, operation: name, data: normalizeOutput(data) })
    );
    return 0;
  } catch (error) {
    write(
      JSON.stringify({
        ok: false,
        operation: name,
        error: serializeError(error),
      })
    );
    return 1;
  }
};

if (
  process.argv[1]?.endsWith("/cli.mjs") ||
  process.argv[1]?.endsWith("\\cli.mjs")
) {
  void runAgentCli().then(code => {
    process.exitCode = code;
  });
}
