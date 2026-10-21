import { describe, expect, it } from "vitest";
import { adjustedPrice, previewPrice, validatePercentage } from "./price-policy";

describe("Política de Precios", () => {
  it("incrementa el precio actual por el porcentaje elegido", () => {
    expect(adjustedPrice(1000, 15, "increase")).toBe(1150);
  });
  it("descuenta el porcentaje elegido del precio actual", () => {
    expect(adjustedPrice(1000, 20, "discount")).toBe(800);
  });
  it("redondea hacia arriba al peso siguiente", () => {
    expect(adjustedPrice(101, 15, "increase")).toBe(117);
    expect(adjustedPrice(101, 20, "discount")).toBe(81);
  });
  it("no suma un peso por errores de coma flotante", () => {
    expect(adjustedPrice(100, 10, "increase")).toBe(110);
  });
  it("no inventa un precio para los productos con precio cero", () => {
    expect(adjustedPrice(0, 15, "increase")).toBe(0);
  });
  it("acepta decimales argentinos en el porcentaje", () => {
    expect(validatePercentage("12,50", "increase")).toBe(12.5);
    expect(adjustedPrice(1000, 12.5, "increase")).toBe(1125);
  });
  it("impide descuentos que generan precios negativos", () => {
    expect(() => validatePercentage("100.01", "discount")).toThrow();
    expect(adjustedPrice(101, 100, "discount")).toBe(0);
  });
  it("ajusta el precio anterior solo cuando se selecciona esa opción", () => {
    expect(previewPrice({ price: 1000, compare_at_price: 2000 }, 15, "increase", true)).toEqual({ price: 1150, compare_at_price: 2300 });
    expect(previewPrice({ price: 1000, compare_at_price: 2000 }, 15, "increase", false)).toEqual({ price: 1150, compare_at_price: 2000 });
  });
  it("no mantiene ofertas cuyo precio anterior ya no supera al actual", () => {
    expect(previewPrice({ price: 1000, compare_at_price: 1100 }, 20, "increase", false)).toEqual({ price: 1200, compare_at_price: null });
  });
});