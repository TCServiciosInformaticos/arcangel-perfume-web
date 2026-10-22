import { test } from "node:test";
import assert from "node:assert/strict";
import { STAFF_MODULES, canOpenAdminPath, validStaffModules } from "./staff-permissions";
test("each checkbox grants only its menu route", () => {
  for (const granted of STAFF_MODULES)
    for (const target of STAFF_MODULES.filter((m) => m !== "resumen")) {
      assert.equal(
        canOpenAdminPath(`/admin/${target}`, false, [granted]),
        granted === target,
        `${granted} -> ${target}`,
      );
    }
  assert.equal(canOpenAdminPath("/admin/productos/other", false, ["productos"]), false);
  assert.equal(canOpenAdminPath("/admin", false, []), false);
  assert.equal(canOpenAdminPath("/admin/slider/", false, ["slider"]), true);
  assert.equal(canOpenAdminPath("/admin/usuarios", true, []), true);
});
test("module input is normalized without granting unknown permissions", () => {
  assert.deepEqual(validStaffModules(["admin", "slider", "slider"]), ["slider"]);
  assert.deepEqual(validStaffModules(["catalogo"]), [
    "productos",
    "categorias",
    "politica-precios",
  ]);
  assert.deepEqual(validStaffModules(null), []);
});
