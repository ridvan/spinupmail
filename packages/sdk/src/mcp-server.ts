#!/usr/bin/env node
import readline from "node:readline";
import { SpinupMailAgentClient } from "@/agent-client";
import { callAgentMcpTool, createAgentMcpTools } from "@/mcp";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const response = (id: JsonRpcRequest["id"], result: unknown) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  result,
});

const errorResponse = (
  id: JsonRpcRequest["id"],
  code: number,
  message: string
) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export const handleAgentMcpRequest = async (
  client: Pick<SpinupMailAgentClient, "execute">,
  request: JsonRpcRequest
) => {
  if (request.jsonrpc !== "2.0" || !request.method) {
    return errorResponse(request.id, -32600, "Invalid Request");
  }
  if (request.method.startsWith("notifications/")) return undefined;
  if (request.method === "initialize") {
    return response(request.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "spinupmail-agent", version: "1.0.0" },
    });
  }
  if (request.method === "ping") return response(request.id, {});
  if (request.method === "tools/list") {
    return response(request.id, { tools: createAgentMcpTools() });
  }
  if (request.method === "tools/call") {
    const name = request.params?.name;
    if (typeof name !== "string") {
      return errorResponse(request.id, -32602, "Tool name is required.");
    }
    try {
      const result = await callAgentMcpTool(
        client,
        name,
        request.params?.arguments
      );
      return response(request.id, result);
    } catch (error) {
      return response(request.id, {
        isError: true,
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : "Tool call failed.",
          },
        ],
      });
    }
  }
  return errorResponse(request.id, -32601, "Method not found");
};

export const runAgentMcpServer = async () => {
  const client = new SpinupMailAgentClient();
  const lines = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let result: unknown;
    try {
      const request = JSON.parse(line) as JsonRpcRequest;
      result = await handleAgentMcpRequest(client, request);
    } catch {
      result = errorResponse(null, -32700, "Parse error");
    }
    if (result !== undefined)
      process.stdout.write(`${JSON.stringify(result)}\n`);
  }
};

if (
  process.argv[1]?.endsWith("/mcp-server.mjs") ||
  process.argv[1]?.endsWith("\\mcp-server.mjs")
) {
  void runAgentMcpServer().catch(error => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "MCP server failed."}\n`
    );
    process.exitCode = 1;
  });
}
