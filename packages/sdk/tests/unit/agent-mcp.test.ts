import { createAgentMcpTools } from "@/mcp";
import { handleAgentMcpRequest } from "@/mcp-server";

describe("agent MCP server", () => {
  it("initializes and publishes only bounded agent tools", async () => {
    const client = { execute: vi.fn() };
    const initialized = await handleAgentMcpRequest(client, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
    });
    const listed = await handleAgentMcpRequest(client, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    const names = createAgentMcpTools().map(tool => tool.name);

    expect(initialized).toMatchObject({
      result: { capabilities: { tools: { listChanged: false } } },
    });
    expect(listed).toMatchObject({ result: { tools: expect.any(Array) } });
    expect(names).toContain("spinupmail_listMessages");
    expect(names).toContain("spinupmail_submitDraft");
    expect(names).not.toContain("spinupmail_enrollAgent");
    expect(names).not.toContain("spinupmail_approveDraft");
    expect(names).not.toContain("spinupmail_updateSendingPolicy");
    expect(JSON.stringify(createAgentMcpTools())).not.toMatch(
      /credential|enrollmentToken/i
    );
  });

  it("dispatches tool calls through the shared operation name", async () => {
    const execute = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const result = await handleAgentMcpRequest(
      { execute },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "spinupmail_listInboxes",
          arguments: { query: {} },
        },
      }
    );

    expect(execute).toHaveBeenCalledWith(
      "listInboxes",
      expect.objectContaining({ query: { limit: 50 } })
    );
    expect(result).toMatchObject({
      result: { content: [{ type: "text" }] },
    });
  });
});
