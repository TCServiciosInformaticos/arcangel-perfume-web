import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG_ROWS_PER_REQUEST, collectPages } from "./catalog-products";

test("sigue leyendo páginas hasta que llega una corta", async () => {
  const ranges: Array<[number, number]> = [];
  const sizes = [CATALOG_ROWS_PER_REQUEST, CATALOG_ROWS_PER_REQUEST, 360];

  const rows = await collectPages(async (from, to) => {
    ranges.push([from, to]);
    return Array.from({ length: sizes[ranges.length - 1] ?? 0 }, (_, i) => from + i);
  });

  assert.equal(rows.length, CATALOG_ROWS_PER_REQUEST * 2 + 360);
  assert.deepEqual(ranges, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

test("se detiene después de una única página corta", async () => {
  const ranges: Array<[number, number]> = [];

  const rows = await collectPages(async (from, to) => {
    ranges.push([from, to]);
    return [from, from + 1];
  });

  assert.deepEqual(rows, [0, 1]);
  assert.deepEqual(ranges, [[0, 999]]);
});
