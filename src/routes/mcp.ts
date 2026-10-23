// Application-owned route: enforce input limits before MCP validation.
import { createFileRoute } from "@tanstack/react-router";

import { createTanStackMcpHandler } from "@lovable.dev/mcp-js/stacks/tanstack";

import mcp from "../lib/mcp/index";
import { limitMcpRequest } from "../lib/mcp-request-limits";

const handleMcp = createTanStackMcpHandler(mcp, {
  resourcePath: "/mcp",
  metadataPath: "/.well-known/oauth-protected-resource",
  trustForwardedHost: true,
  trustForwardedProto: true,
});

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const limited = await limitMcpRequest(request);
        if (limited instanceof Response) return limited;
        return handleMcp({ request: limited });
      },
    },
  },
});
