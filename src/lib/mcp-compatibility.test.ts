import { strict as assert } from "node:assert";
import { test } from "node:test";
import { auth, defineMcp, defineTool } from "@lovable.dev/mcp-js";
import { createTanStackMcpHandler } from "@lovable.dev/mcp-js/stacks/tanstack";
import { withMcpClient } from "@lovable.dev/mcp-js/testing/server";
import { z } from "zod";
import { limitMcpRequest } from "./mcp-request-limits";

test("patched MCP dependencies serve independent concurrent clients in both protocol eras", async () => {
  const handler = createTanStackMcpHandler(
    defineMcp({
      name: "isolated-test",
      title: "Isolated test",
      instructions: "",
      version: "1.0.0",
      tools: [
        defineTool({
          name: "echo",
          title: "Echo test",
          description: "Test only",
          inputSchema: { text: z.string() },
          async handler({ text }) {
            return { content: [{ type: "text", text }] };
          },
        }),
      ],
    }),
  );
  for (const protocolVersion of ["2025-11-25", "2026-07-28"] as const) {
    await Promise.all(
      ["first", "second"].map((text) =>
        withMcpClient(
          {
            endpoint: "https://example.com/mcp",
            protocolVersion,
            handler: async (request) => {
              const limited = await limitMcpRequest(request);
              return limited instanceof Response ? limited : handler({ request: limited });
            },
          },
          async (client) => {
            const result = await client.callTool({ name: "echo", arguments: { text } });
            assert.deepEqual(result.content, [{ type: "text", text }]);
          },
        ),
      ),
    );
  }
});

test("MCP still rejects unauthenticated catalog clients with an OAuth challenge", async () => {
  const handler = createTanStackMcpHandler(
    defineMcp({
      name: "protected-test",
      title: "Protected test",
      instructions: "",
      version: "1.0.0",
      tools: [],
      auth: auth.oauth.issuer({
        issuer: "https://example.com/auth/v1",
        acceptedAudiences: "authenticated",
        requireOAuthClientClaim: true,
      }),
    }),
  );
  const response = await handler({
    request: new Request("https://example.com/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }),
  });
  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate") ?? "", /Bearer/);
});
