import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAdminSearch, applyAdminProductSearch } from "./admin-product-search";

function fakeRequest(calls: string[]) {
  const req: { or: (filters: string) => unknown } = {
    or: (filters: string) => {
      calls.push(filters);
      return req;
    },
  };
  return req;
}

test("normaliza espacios, comodines y comillas del término", () => {
  assert.equal(normalizeAdminSearch("  shampoo   secante  "), "shampoo secante");
  assert.equal(normalizeAdminSearch(' "fidelité" 50%_off '), "fidelité 50 off");
  assert.equal(normalizeAdminSearch("   "), "");
  assert.equal(normalizeAdminSearch("a".repeat(80)).length, 60);
});

test("sin término no agrega ningún filtro", () => {
  const calls: string[] = [];
  const request = fakeRequest(calls);
  assert.equal(applyAdminProductSearch(request, "   "), request);
  assert.deepEqual(calls, []);
});

test("busca en nombre, slug y descripción con el patrón entre comillas", () => {
  const calls: string[] = [];
  applyAdminProductSearch(fakeRequest(calls), "shampoo secante");
  assert.deepEqual(calls, [
    'name.ilike."%shampoo secante%",slug.ilike."%shampoo secante%",description.ilike."%shampoo secante%"',
  ]);
});
