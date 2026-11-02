import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import ExcelJS from "exceljs";
const require = createRequire(import.meta.url);
const glob = require("glob") as { sync: (pattern: string, options?: object) => string[] };

test("legacy glob finds files with the patched minimatch", () => {
  for (const pattern of [
    "src/lib/**/*.test.ts",
    "src/{lib,components}/**/*.{ts,tsx}",
    "src/**/!(*.test).ts",
  ]) {
    const results = glob.sync(pattern, { nodir: true });
    assert.ok(results.length > 0, `Expected matches for ${pattern}`);
  }
  assert.ok(
    glob.sync("src/lib/**/*.test.ts").includes("src/lib/supplier-price-comparison.test.ts"),
  );
});

test("Excel workbooks still round trip after dependency update", async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Lista").addRow(["EAN", "Precio"]);
  const data = await book.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(data);
  assert.equal(loaded.worksheets[0].getCell("A1").value, "EAN");
});

test("archiver includes files selected by glob", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { Writable } = await import("node:stream");
  const createArchive = require("archiver") as (format: string) => any;
  const dir = await mkdtemp(join(tmpdir(), "arcangel-glob-"));
  try {
    await writeFile(join(dir, "include.txt"), "ok");
    await writeFile(join(dir, "exclude.jpg"), "no");
    const archive = createArchive("zip");
    const entries: string[] = [];
    archive.on("entry", (entry: { name: string }) => entries.push(entry.name));
    archive.pipe(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      }),
    );
    archive.glob("*.txt", { cwd: dir });
    await archive.finalize();
    assert.deepEqual(entries, ["include.txt"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
