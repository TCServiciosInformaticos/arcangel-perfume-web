import { describe, expect, it } from "vitest";
import { CATALOG_ROWS_PER_REQUEST, collectPages } from "./catalog-products";

describe("collectPages", () => {
  it("keeps reading pages until a short one arrives", async () => {
    const ranges: Array<[number, number]> = [];
    const sizes = [CATALOG_ROWS_PER_REQUEST, CATALOG_ROWS_PER_REQUEST, 360];

    const rows = await collectPages(async (from, to) => {
      ranges.push([from, to]);
      const size = sizes[ranges.length - 1] ?? 0;
      return Array.from({ length: size }, (_, i) => from + i);
    });

    expect(rows).toHaveLength(CATALOG_ROWS_PER_REQUEST * 2 + 360);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(rows[rows.length - 1]).toBe(2359);
  });

  it("stops after a single short page", async () => {
    const ranges: Array<[number, number]> = [];

    const rows = await collectPages(async (from, to) => {
      ranges.push([from, to]);
      return [from, from + 1];
    });

    expect(rows).toEqual([0, 1]);
    expect(ranges).toEqual([[0, 999]]);
  });
});
