import { test } from "node:test";
import assert from "node:assert/strict";
import { canOpenAdminPath, validStaffModules } from "./staff-permissions";
test("staff routes fail closed and never grant owner modules", () => {
  for (const path of [
    "/admin/usuarios",
    "/admin/estadisticas",
    "/admin/herramientas",
    "/admin/productos/other",
    "/admin/pedidos-otro",
  ])
    assert.equal(canOpenAdminPath(path, false, ["catalogo", "pedidos", "slider"]), false, path);
  assert.equal(canOpenAdminPath("/admin", false, []), false);
  assert.equal(canOpenAdminPath("/admin/slider/", false, ["slider"]), true);
  assert.equal(canOpenAdminPath("/admin/productos", false, ["slider"]), false);
  assert.equal(canOpenAdminPath("/admin/politica-precios", false, ["catalogo"]), true);
  assert.equal(canOpenAdminPath("/admin/usuarios", true, []), true);
});
test("unknown or malformed module assignments cannot become permissions", () => {
  assert.deepEqual(validStaffModules(["admin", "usuarios", "slider", "slider"]), ["slider"]);
  assert.deepEqual(validStaffModules("catalogo"), []);
  assert.deepEqual(validStaffModules(null), []);
});
