import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adjustedPrice, previewPrice, validatePercentage } from "./price-policy";

describe("Política de Precios", () => {
  it("incrementa el precio actual por el porcentaje elegido", () => {
    assert.equal(adjustedPrice(1000, 15, "increase"), 1150);
  });
  it("descuenta el porcentaje elegido del precio actual", () => {
    assert.equal(adjustedPrice(1000, 20, "discount"), 800);
  });
  it("redondea hacia arriba al peso siguiente", () => {
    assert.equal(adjustedPrice(101, 15, "increase"), 117);
    assert.equal(adjustedPrice(101, 20, "discount"), 81);
  });
  it("no suma un peso por errores de coma flotante", () => {
    assert.equal(adjustedPrice(100, 10, "increase"), 110);
  });
  it("no inventa un precio para los productos con precio cero", () => {
    assert.equal(adjustedPrice(0, 15, "increase"), 0);
  });
  it("acepta decimales argentinos en el porcentaje", () => {
    assert.equal(validatePercentage("12,50", "increase"), 12.5);
    assert.equal(adjustedPrice(1000, 12.5, "increase"), 1125);
  });
  it("impide descuentos que generan precios negativos", () => {
    assert.throws(() => validatePercentage("100.01", "discount"));
    assert.equal(adjustedPrice(101, 100, "discount"), 0);
  });
  it("ajusta el precio anterior solo cuando se selecciona esa opción", () => {
    assert.deepEqual(previewPrice({ price: 1000, compare_at_price: 2000 }, 15, "increase", true), { price: 1150, compare_at_price: 2300 });
    assert.deepEqual(previewPrice({ price: 1000, compare_at_price: 2000 }, 15, "increase", false), { price: 1150, compare_at_price: 2000 });
  });
  it("no mantiene ofertas cuyo precio anterior ya no supera al actual", () => {
    assert.deepEqual(previewPrice({ price: 1000, compare_at_price: 1100 }, 20, "increase", false), { price: 1200, compare_at_price: null });
  });
});