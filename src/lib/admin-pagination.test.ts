import { test } from "node:test";
import assert from "node:assert/strict";
import { adminPageRange, adminPageCount } from "./admin-pagination";

test("páginas siguientes leen rangos sin repetir ni omitir artículos", () => {
  assert.deepEqual(adminPageRange(1), { from: 0, to: 23 });
  assert.deepEqual(adminPageRange(2), { from: 24, to: 47 });
  assert.deepEqual(adminPageRange(57), { from: 1344, to: 1367 });
});

test("cuenta la última página parcial y conserva una página vacía", () => {
  assert.equal(adminPageCount(1360), 57);
  assert.equal(adminPageCount(48), 2);
  assert.equal(adminPageCount(0), 1);
  assert.deepEqual(adminPageRange(0), { from: 0, to: 23 });
});