import { test, expect } from "@playwright/test";

test("MCP guards remain active on the mounted HTTP route", async ({ request }) => {
  const metadata = await request.get("/.well-known/oauth-protected-resource");
  expect(metadata.status()).toBe(200);
  expect((await metadata.json()).resource).toMatch(/\/mcp$/);
  for (let id = 1; id <= 2; id++) {
    const response = await request.post("/mcp", {
      data: { jsonrpc: "2.0", id, method: "tools/list" },
    });
    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toContain("Bearer");
  }
  const oversized = await request.post("/mcp", { data: { text: "x".repeat(65536) } });
  expect(oversized.status()).toBe(413);
});
