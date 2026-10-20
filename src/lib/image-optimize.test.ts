import { describe, expect, it } from "vitest";
import { resolveThumbnail } from "./image-optimize";

describe("resolveThumbnail", () => {
  it("usa la miniatura recién generada para la foto principal", () => {
    expect(resolveThumbnail("a", { a: "a-thumb" }, { first: "x", thumb: "x-thumb" })).toBe("a-thumb");
  });
  it("conserva la miniatura guardada si la foto principal no cambió", () => {
    expect(resolveThumbnail("x", {}, { first: "x", thumb: "x-thumb" })).toBe("x-thumb");
  });
  it("descarta la miniatura vieja si cambió la foto principal", () => {
    expect(resolveThumbnail("y", {}, { first: "x", thumb: "x-thumb" })).toBeNull();
  });
});
