import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparisonSessionKey,
  readComparisonSession,
  writeComparisonSession,
} from "./supplier-price-session";
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear() {
      items.clear();
    },
    getItem(k) {
      return items.get(k) ?? null;
    },
    key(i) {
      return [...items.keys()][i] ?? null;
    },
    removeItem(k) {
      items.delete(k);
    },
    setItem(k, v) {
      items.set(k, v);
    },
  };
}
test("comparison survives a screen remount and is separated by user", () => {
  const storage = memoryStorage();
  const snapshot = {
    batches: [{ id: "1", offers: [{ barcode: "0012345678905", price: 1234.5, stock: 0 }] }],
    search: "jabón",
  };
  writeComparisonSession(storage, "ana", snapshot);
  assert.deepEqual(readComparisonSession(storage, "ana"), snapshot);
  assert.equal(readComparisonSession(storage, "bea"), null);
  assert.notEqual(comparisonSessionKey("ana"), comparisonSessionKey("bea"));
});
test("storage errors are surfaced so the screen can warn the user", () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    throw new Error("quota");
  };
  assert.throws(() => writeComparisonSession(storage, "ana", {}), /quota/);
});
