import { z } from "zod";
import {
  agentMcpOperationNames,
  agentOperationInputSchema,
  agentOperations,
  type AgentOperationDefinition,
  type AgentOperationName,
} from "@/contracts";
import { SpinupMailAgentClient, type AgentCallInput } from "@/agent-client";

const toolPrefix = "spinupmail_";

export const createAgentMcpTools = () =>
  agentMcpOperationNames.map(name => {
    const definition = agentOperations[name] as AgentOperationDefinition;
    const inputSchema = z.toJSONSchema(
      agentOperationInputSchema(definition)
    ) as Record<string, unknown>;
    delete inputSchema.$schema;
    return {
      name: `${toolPrefix}${name}`,
      title: definition.summary,
      description: `${definition.method} ${definition.path}. ${definition.summary}`,
      inputSchema,
    };
  });

export const callAgentMcpTool = async (
  client: Pick<SpinupMailAgentClient, "execute">,
  toolName: string,
  input: unknown
) => {
  if (!toolName.startsWith(toolPrefix)) throw new Error("Unknown MCP tool.");
  const name = toolName.slice(toolPrefix.length) as AgentOperationName;
  const definition = agentOperations[name] as
    AgentOperationDefinition | undefined;
  if (!definition?.mcp) throw new Error("MCP tool is unavailable.");
  const invocation = agentOperationInputSchema(definition).parse(input ?? {});
  const value = await client.execute(name, invocation as AgentCallInput);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value ?? { ok: true }),
      },
    ],
  };
};
