// Bound JSON before MCP schema validation, including requests without Content-Length.
const MAX_BYTES = 64 * 1024;
const MAX_ELEMENTS = 1000;
const MAX_DEPTH = 32;

export async function limitMcpRequest(request: Request): Promise<Request | Response> {
  if (request.method !== "POST") return request;
  const reject = () => new Response("MCP request exceeds input limits", { status: 413 });
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES) return reject();
  const reader = request.body?.getReader();
  if (!reader) return request;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        void reader.cancel().catch(() => {});
        return reject();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const stack: Array<{ value: unknown; depth: number }> = [{ value: parsed, depth: 0 }];
  let elements = 0;
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (!value || typeof value !== "object") continue;
    if (depth > MAX_DEPTH) return reject();
    const children = Object.values(value);
    elements += children.length;
    if (elements > MAX_ELEMENTS) return reject();
    for (const child of children) stack.push({ value: child, depth: depth + 1 });
  }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(request, { body: bytes, headers });
}
