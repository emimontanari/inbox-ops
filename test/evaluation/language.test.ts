import { describe, expect, it } from "vitest";
import { detectLanguage } from "../../src/evaluation/language.js";

describe("detectLanguage", () => {
  it("detects a Spanish summary", () => {
    expect(detectLanguage("El cliente quiere devolver el pedido 61002 porque le quedó chico.")).toBe("es");
  });

  it("detects an English summary", () => {
    expect(detectLanguage("The customer wants to return order 61002 because it is too small.")).toBe("en");
  });

  it("counts Spanish-only characters as evidence even without common words", () => {
    expect(detectLanguage("Cobro duplicado según tarjeta.")).toBe("es");
  });

  it("returns unknown when there is no evidence either way", () => {
    expect(detectLanguage("Pedido 61002.")).toBe("unknown");
  });
});
