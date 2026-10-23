import { strict as assert } from "node:assert";
import { test } from "node:test";
import { limitMcpRequest } from "./mcp-request-limits";

const post = (body: string) =>
  new Request("https://example.com/mcp", {
    method: "POST",
    body,
    headers: { authorization: "Bearer test", "content-type": "application/json" },
  });

test("MCP preserves valid JSON, authorization and GET requests", async () => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "search_products", arguments: { query: "shampoo" } },
  });
  const result = await limitMcpRequest(post(body));
  assert.ok(result instanceof Request);
  assert.equal(await result.text(), body);
  assert.equal(result.headers.get("authorization"), "Bearer test");
  const get = new Request("https://example.com/mcp");
  assert.equal(await limitMcpRequest(get), get);
});

test("MCP rejects invalid JSON, deep objects and excessive elements", async () => {
  for (const [body, status] of [
    ["{broken", 400],
    [JSON.stringify(Array.from({ length: 1001 }, () => 0)), 413],
    ['{"x":'.repeat(40) + "0" + "}".repeat(40), 413],
    [JSON.stringify("x".repeat(65536)), 413],
  ] as const) {
    const result = await limitMcpRequest(post(body));
    assert.ok(result instanceof Response);
    assert.equal(result.status, status);
  }
});

test("MCP bounds streamed bodies without Content-Length", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(40000));
      controller.enqueue(new Uint8Array(40000));
      controller.close();
    },
  });
  const request = new Request("https://example.com/mcp", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  const result = await limitMcpRequest(request);
  assert.ok(result instanceof Response);
  assert.equal(result.status, 413);
});

test("MCP accepts framework Request proxies without native private-field errors", async () => {
  const original = post('{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
  const proxy = new Proxy(original, {
    get(target, property) {
      if (property === "redirect" && target.bodyUsed) {
        throw new Error("Framework metadata cannot initialize after body consumption");
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const result = await limitMcpRequest(proxy);
  assert.ok(result instanceof Request);
  assert.equal(result.method, "POST");
  assert.equal(result.headers.get("authorization"), "Bearer test");
  assert.equal((await result.json()).method, "tools/list");
});
