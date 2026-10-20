import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolveThumbnail } from "./image-optimize";

test("usa la miniatura recién generada para la foto principal", () => {
  assert.equal(resolveThumbnail("a", { a: "a-thumb" }, { first: "x", thumb: "x-thumb" }), "a-thumb");
});
test("conserva la miniatura guardada si la foto principal no cambió", () => {
  assert.equal(resolveThumbnail("x", {}, { first: "x", thumb: "x-thumb" }), "x-thumb");
});
test("descarta la miniatura vieja si cambió la foto principal", () => {
  assert.equal(resolveThumbnail("y", {}, { first: "x", thumb: "x-thumb" }), null);
});
